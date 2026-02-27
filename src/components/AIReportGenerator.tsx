import { useState } from "react";
import { aiMonthlyReport } from "@/lib/ai-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Brain, Loader2, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface AIReportGeneratorProps {
  month: string;
}

const AIReportGenerator = ({ month }: AIReportGeneratorProps) => {
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setReport(null);
    try {
      const { report: reportContent } = await aiMonthlyReport(month);
      setReport(reportContent);
      toast({ title: "Report Generated", description: `Leadership report for ${month} is ready.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Report Generation Failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            AI Leadership Report
          </CardTitle>
          <Button size="sm" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
            {generating ? "Generating..." : "Generate Report"}
          </Button>
        </div>
      </CardHeader>
      {report && (
        <CardContent>
          <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default AIReportGenerator;
