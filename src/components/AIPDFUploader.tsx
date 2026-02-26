import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
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
      let body: any;

      if ((ext === "pdf" || ext === "docx") && file.size > DIRECT_UPLOAD_THRESHOLD) {
        // Large file: upload to storage first, then pass path
        setStatusText("Uploading file...");
        const storagePath = `ai-parse/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("requirement-files")
          .upload(storagePath, file);

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        setStatusText("Parsing document (this may take a minute)...");
        body = { storagePath, fileName: file.name, fileType: ext };
      } else if (ext === "pdf" || ext === "docx") {
        // Small binary file: send as base64
        setStatusText("Parsing document...");
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        body = { base64, fileName: file.name, fileType: ext };
      } else {
        setStatusText("Parsing document...");
        const text = await file.text();
        body = { text };
      }

      const { data, error } = await supabase.functions.invoke("ai-parse-pdf", { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setExtracted(data);
      toast({ title: "Extraction Complete", description: data.summary });
    } catch (e: any) {
      toast({ title: "Parsing Failed", description: e.message, variant: "destructive" });
    } finally {
      setParsing(false);
      setStatusText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImport = async (index: number, req: any) => {
    setImporting((prev) => ({ ...prev, [index]: true }));
    try {
      const { data, error } = await supabase
        .from("requirements")
        .insert({
          title: req.title,
          description: req.description,
          source_type: req.source_type || "OTHER",
          priority: req.priority || "P2",
          tech_level: req.tech_level || "LOW",
          therapy_domains: req.therapy_domains || [],
          disability_types: req.disability_types || [],
          gap_flags: req.gap_flags || [],
          market_price: req.market_price || null,
          stride_target_price: req.stride_target_price || null,
          current_state: "S1",
          created_by: null,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        await supabase.from("state_transitions").insert({
          requirement_id: data.id,
          from_state: "NEW",
          to_state: "S1",
          transitioned_by: null,
          notes: "Imported from document via AI extraction",
        });
        setImported((prev) => ({ ...prev, [index]: data.id }));
        toast({ title: "Imported", description: `"${req.title}" added to pipeline.` });
      }
    } catch (e: any) {
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
    let successCount = 0;
    let failCount = 0;

    for (const { req, i } of remaining) {
      try {
        setImporting((prev) => ({ ...prev, [i]: true }));
        const { data, error } = await supabase
          .from("requirements")
          .insert({
            title: req.title,
            description: req.description,
            source_type: req.source_type || "OTHER",
            priority: req.priority || "P2",
            tech_level: req.tech_level || "LOW",
            therapy_domains: req.therapy_domains || [],
            disability_types: req.disability_types || [],
            gap_flags: req.gap_flags || [],
            market_price: req.market_price || null,
            stride_target_price: req.stride_target_price || null,
            current_state: "S1",
            created_by: null,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          await supabase.from("state_transitions").insert({
            requirement_id: data.id,
            from_state: "NEW",
            to_state: "S1",
            transitioned_by: null,
            notes: "Imported from document via AI extraction",
          });
          setImported((prev) => ({ ...prev, [i]: data.id }));
          successCount++;
        }
      } catch {
        failCount++;
      } finally {
        setImporting((prev) => ({ ...prev, [i]: false }));
      }
    }

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
                    <p className="text-sm font-medium text-foreground">{req.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{req.description}</p>
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
