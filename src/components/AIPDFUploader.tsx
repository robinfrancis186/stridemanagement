import { useState, useRef } from "react";
import { db, functions, storage } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { FileSearch, Upload, Loader2, Check, Plus, CheckCheck } from "lucide-react";

const AIPDFUploader = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [extracted, setExtracted] = useState<any>(null);
  const [importing, setImporting] = useState<Record<number, boolean>>({});
  const [imported, setImported] = useState<Record<number, string>>({});

  const MAX_FILE_SIZE_MB = 50;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  const DIRECT_UPLOAD_THRESHOLD = 5 * 1024 * 1024; // 5MB

  const parsePrice = (val: any) => {
    if (val === null || val === undefined) return null;
    const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
    return isNaN(num) ? null : num;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: "File Too Large",
        description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setParsing(true);
    setExtracted(null);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      setStatusText("Parsing document with AI...");

      const { getGeminiModel } = await import("@/lib/gemini");
      const model = getGeminiModel();

      const systemPrompt = `You are an expert at extracting structured requirement data from documents for STRIDE COE assistive technology pipeline.

Extract all identifiable requirements from the document. For each requirement, extract:
- title: concise device/requirement name
- description: detailed description
- source_type: one of CDC, SEN, BLIND, ELDERLY, BUDS, OTHER
- priority: P1 (urgent), P2 (standard), P3 (low)
- tech_level: LOW, MEDIUM, HIGH
- therapy_domains: array from [OT, PT, Speech, ADL, Sensory, Cognitive]
- disability_types: array from [Physical, Visual, Hearing, Cognitive, Multiple]
- gap_flags: array from [RED, BLUE] or empty
- market_price: number or null
- stride_target_price: number or null

Be thorough and extract every requirement you can identify.
Return your response as valid JSON with this structure:
{
  "requirements": [...],
  "summary": "Brief summary of what was extracted"
}`;

      let parts = [];
      if (ext === "pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        parts = [
          { text: `${systemPrompt}\n\nExtract all requirements from this uploaded PDF document.` },
          { inlineData: { data: base64, mimeType: "application/pdf" } }
        ];
      } else {
        const text = await file.text();
        parts = [
          { text: `${systemPrompt}\n\nExtract requirements from this document text:\n\n${text.slice(0, 30000)}` },
        ];
      }

      const result = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      });

      const responseText = result.response.text();
      if (!responseText) throw new Error("No extraction returned from AI");

      const data = JSON.parse(responseText);
      setExtracted(data);
      toast({ title: "Extraction Complete", description: data.summary });
    } catch (e: any) {
      console.error("PDF Parsing error:", e);
      toast({ title: "Parsing Failed", description: e.message || "Failed to parse document", variant: "destructive" });
    } finally {
      setParsing(false);
      setStatusText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImport = async (index: number, req: any) => {
    setImporting((prev) => ({ ...prev, [index]: true }));
    try {
      const docRef = await addDoc(collection(db, "requirements"), {
        title: String(req.title || "Untitled Requirement"),
        description: String(req.description || "No description provided."),
        source_type: req.source_type || "OTHER",
        priority: req.priority || "P2",
        tech_level: req.tech_level || "LOW",
        therapy_domains: Array.isArray(req.therapy_domains) ? req.therapy_domains : [],
        disability_types: Array.isArray(req.disability_types) ? req.disability_types : [],
        gap_flags: Array.isArray(req.gap_flags) ? req.gap_flags : [],
        market_price: parsePrice(req.market_price),
        stride_target_price: parsePrice(req.stride_target_price),
        current_state: "S1",
        created_by: user?.uid || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      if (docRef.id) {
        await addDoc(collection(db, "state_transitions"), {
          requirement_id: docRef.id,
          from_state: "NEW",
          to_state: "S1",
          transitioned_by: user?.uid || null,
          notes: "Imported from document via AI extraction",
          created_at: new Date().toISOString()
        });
        setImported((prev) => ({ ...prev, [index]: docRef.id }));
        toast({ title: "Imported", description: `"${req.title || 'Requirement'}" added to pipeline.` });
      }
    } catch (e: any) {
      console.error("Single import failed:", e);
      toast({ title: "Import Failed", description: e.message, variant: "destructive" });
    } finally {
      setImporting((prev) => ({ ...prev, [index]: false }));
    }
  };

  const [importingAll, setImportingAll] = useState(false);

  const handleImportAll = async () => {
    if (!extracted?.requirements) return;
    const remaining = extracted.requirements
      .map((req: any, i: number) => ({ req, i }))
      .filter(({ i }: { i: number }) => !imported[i]);

    if (remaining.length === 0) {
      toast({ title: "All imported", description: "All requirements have already been imported." });
      return;
    }

    setImportingAll(true);

    const importPromises = remaining.map(async ({ req, i }) => {
      setImporting((prev) => ({ ...prev, [i]: true }));
      try {
        const docRef = await addDoc(collection(db, "requirements"), {
          title: String(req.title || "Untitled Requirement"),
          description: String(req.description || "No description provided."),
          source_type: req.source_type || "OTHER",
          priority: req.priority || "P2",
          tech_level: req.tech_level || "LOW",
          therapy_domains: Array.isArray(req.therapy_domains) ? req.therapy_domains : [],
          disability_types: Array.isArray(req.disability_types) ? req.disability_types : [],
          gap_flags: Array.isArray(req.gap_flags) ? req.gap_flags : [],
          market_price: parsePrice(req.market_price),
          stride_target_price: parsePrice(req.stride_target_price),
          current_state: "S1",
          created_by: user?.uid || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        if (docRef.id) {
          await addDoc(collection(db, "state_transitions"), {
            requirement_id: docRef.id,
            from_state: "NEW",
            to_state: "S1",
            transitioned_by: user?.uid || null,
            notes: "Imported from document via AI extraction",
            created_at: new Date().toISOString()
          });
          setImported((prev) => ({ ...prev, [i]: docRef.id }));
          return { status: 'fulfilled', i };
        }
      } catch (error) {
        console.error("Single import failed:", error);
        throw error;
      } finally {
        setImporting((prev) => ({ ...prev, [i]: false }));
      }
    });

    const results = await Promise.allSettled(importPromises);
    const successCount = results.filter(r => r.status === "fulfilled").length;
    const failCount = results.length - successCount;

    setImportingAll(false);
    toast({
      title: "Bulk Import Complete",
      description: `${successCount} imported${failCount > 0 ? `, ${failCount} failed` : ""}.`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-base flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-primary" />
          AI Document Parser
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <input ref={fileInputRef} type="file" accept=".txt,.csv,.md,.json,.pdf,.docx" className="hidden" onChange={handleFileSelect} />
        <Button onClick={() => fileInputRef.current?.click()} disabled={parsing} variant="outline" className="w-full">
          {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {parsing ? (statusText || "Parsing document...") : "Upload Document for AI Extraction"}
        </Button>
        <p className="text-xs text-muted-foreground">Supports .txt, .csv, .md, .json, .pdf, .docx files (max {MAX_FILE_SIZE_MB}MB). AI will extract requirements automatically.</p>

        {extracted?.requirements && (
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Extracted {extracted.requirements.length} requirement(s):
              </p>
              {extracted.requirements.length > 1 && (
                <Button
                  size="sm"
                  onClick={handleImportAll}
                  disabled={importingAll || extracted.requirements.every((_: any, i: number) => imported[i])}
                >
                  {importingAll ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="mr-1 h-3.5 w-3.5" />}
                  {importingAll ? "Importing..." : "Import All"}
                </Button>
              )}
            </div>
            {extracted.requirements.map((req: any, i: number) => (
              <div key={i} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{String(req.title || 'Untitled')}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{String(req.description || '')}</p>
                  </div>
                  {imported[i] ? (
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/requirements/${imported[i]}`)}>
                      <Check className="mr-1 h-3.5 w-3.5 text-success" /> View
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => handleImport(i, req)} disabled={importing[i]}>
                      {importing[i] ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                      Import
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-[10px]">{req.source_type}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{req.priority}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{req.tech_level}</Badge>
                  {req.gap_flags?.map((g: string) => (
                    <Badge key={g} className={`text-[10px] ${g === "RED" ? "bg-destructive text-destructive-foreground" : "bg-info text-info-foreground"}`}>{g}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIPDFUploader;
