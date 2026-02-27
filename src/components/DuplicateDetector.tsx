import { useState } from "react";
import { aiDuplicateCheck } from "@/lib/ai-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Search, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

interface Duplicate {
  id: string;
  title: string;
  similarity: "exact" | "high" | "moderate";
  reason: string;
}

interface DuplicateDetectorProps {
  title: string;
  description: string;
}

const similarityColors: Record<string, string> = {
  exact: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500 text-white",
  moderate: "bg-yellow-500 text-white",
};

const DuplicateDetector = ({ title, description }: DuplicateDetectorProps) => {
  const [checking, setChecking] = useState(false);
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null);

  const handleCheck = async () => {
    if (!title.trim()) {
      toast({ title: "Enter a title first", description: "A title is needed to check for duplicates.", variant: "destructive" });
      return;
    }
    setChecking(true);
    setDuplicates(null);
    try {
      const data = await aiDuplicateCheck(title, description);
      setDuplicates(data.duplicates || []);
      if ((data.duplicates || []).length === 0) {
        toast({ title: "No Duplicates Found", description: "This requirement appears to be unique." });
      } else {
        toast({ title: "Potential Duplicates Found", description: `${data.duplicates.length} similar requirement(s) detected.`, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Duplicate Check Failed", description: e.message, variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card className="shadow-card border-dashed">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            AI Duplicate Detection
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handleCheck} disabled={checking}>
            {checking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
            {checking ? "Checking..." : "Check Duplicates"}
          </Button>
        </div>
      </CardHeader>
      {duplicates !== null && (
        <CardContent>
          {duplicates.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              No duplicates found — this requirement is unique.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {duplicates.length} potential duplicate(s) detected:
              </div>
              {duplicates.map((d) => (
                <div key={d.id} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Link to={`/requirements/${d.id}`} className="text-sm font-medium text-primary hover:underline">
                      {d.title}
                    </Link>
                    <Badge className={similarityColors[d.similarity]}>{d.similarity}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{d.reason}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default DuplicateDetector;
