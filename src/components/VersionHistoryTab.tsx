import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { History } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface Version {
  id: string;
  changed_by: string | null;
  changes: Record<string, { old: string; new: string }>;
  created_at: string;
}

const VersionHistoryTab = ({ requirementId }: { requirementId: string }) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from("requirement_versions")
          .select("*")
          .eq("requirement_id", requirementId)
          .order("created_at", { ascending: false });

        setVersions((data as unknown as Version[]) || []);
      } catch (error) {
        console.error("Failed to load version history:", error);
        setVersions([]);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [requirementId]);

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading...</div>;

  if (versions.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          No version history recorded yet. Changes will be tracked as the requirement is edited.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <Card key={v.id} className="shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-sm flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Edit
              </CardTitle>
              <span className="text-[11px] text-muted-foreground">{format(new Date(v.created_at), "PPp")}</span>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {v.changes && Object.entries(v.changes).map(([field, change]) => (
              <div key={field} className="rounded border p-2">
                <p className="text-xs font-medium text-muted-foreground capitalize mb-1">{field.replace(/_/g, " ")}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <Badge variant="outline" className="text-[9px] mb-1">Before</Badge>
                    <p className="text-muted-foreground">{String(change.old || "—")}</p>
                  </div>
                  <div>
                    <Badge variant="outline" className="text-[9px] mb-1 border-primary text-primary">After</Badge>
                    <p>{String(change.new || "—")}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default VersionHistoryTab;
