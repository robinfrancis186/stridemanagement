import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Brain, Sparkles, FileSearch, FlaskConical, Loader2, FileText } from "lucide-react";

interface AIActionsBarProps {
  requirementId: string;
  onClassified?: () => void;
  onDoeGenerated?: () => void;
  onDocGenerated?: () => void;
}

const AIActionsBar = ({ requirementId, onClassified, onDoeGenerated, onDocGenerated }: AIActionsBarProps) => {
  const [classifying, setClassifying] = useState(false);
  const [generatingDoe, setGeneratingDoe] = useState(false);
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [lastResult, setLastResult] = useState<{ type: string; data: any } | null>(null);

  const handleClassify = async () => {
    setClassifying(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-classify", {
        body: { requirementId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setLastResult({ type: "classification", data: data.classification });
      toast({ title: "AI Classification Complete", description: data.classification.reasoning });
      onClassified?.();
    } catch (e: any) {
      toast({ title: "Classification Failed", description: e.message, variant: "destructive" });
    } finally {
      setClassifying(false);
    }
  };

  const handleGenerateDoe = async () => {
    setGeneratingDoe(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-doe-template", {
        body: { requirementId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setLastResult({ type: "doe", data: data.template });
      toast({ title: "DoE Template Generated", description: "A new DoE record has been created with AI-generated protocols." });
      onDoeGenerated?.();
    } catch (e: any) {
      toast({ title: "DoE Generation Failed", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingDoe(false);
    }
  };

  const handleGenerateDoc = async () => {
    setGeneratingDoc(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-device-doc", {
        body: { requirementId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setLastResult({ type: "doc", data: data.document });
      toast({ title: "Device Doc Package Generated", description: "Full documentation package is ready." });
      onDocGenerated?.();
    } catch (e: any) {
      toast({ title: "Doc Generation Failed", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingDoc(false);
    }
  };

  return (
    <Card className="shadow-card border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">AI Agent Actions</span>
          <Badge variant="secondary" className="text-[10px]">Powered by Lovable AI</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleClassify} disabled={classifying}>
            {classifying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            {classifying ? "Classifying..." : "Auto-Classify"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleGenerateDoe} disabled={generatingDoe}>
            {generatingDoe ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="mr-1.5 h-3.5 w-3.5" />}
            {generatingDoe ? "Generating..." : "Generate DoE Template"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleGenerateDoc} disabled={generatingDoc}>
            {generatingDoc ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
            {generatingDoc ? "Generating Doc..." : "Generate Device Doc Package"}
          </Button>
        </div>

        {lastResult?.type === "classification" && (
          <div className="mt-2 p-3 bg-muted/50 rounded-lg space-y-2 text-sm">
            <p className="font-medium text-foreground">Classification Result:</p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">Tech: {lastResult.data.tech_level}</Badge>
              <Badge variant="secondary">Priority: {lastResult.data.priority}</Badge>
              {lastResult.data.therapy_domains?.map((d: string) => (
                <Badge key={d} variant="outline">{d}</Badge>
              ))}
              {lastResult.data.disability_types?.map((d: string) => (
                <Badge key={d} variant="outline">{d}</Badge>
              ))}
              {lastResult.data.gap_flags?.map((g: string) => (
                <Badge key={g} className={g === "RED" ? "bg-destructive text-destructive-foreground" : "bg-info text-info-foreground"}>{g}</Badge>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">{lastResult.data.reasoning}</p>
          </div>
        )}

        {lastResult?.type === "doe" && (
          <div className="mt-2 p-3 bg-muted/50 rounded-lg space-y-1 text-sm">
            <p className="font-medium text-foreground">DoE Template Generated</p>
            <p className="text-muted-foreground text-xs">Sample size: {lastResult.data.sample_size} | Duration: {lastResult.data.estimated_duration_weeks} weeks</p>
            <p className="text-muted-foreground text-xs">Check the DoE tab for full details.</p>
          </div>
        )}

        {lastResult?.type === "doc" && (
          <div className="mt-2 p-3 bg-muted/50 rounded-lg space-y-2 text-sm max-h-96 overflow-y-auto">
            <p className="font-medium text-foreground">Device Documentation Package</p>
            <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-mono">{lastResult.data}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIActionsBar;
