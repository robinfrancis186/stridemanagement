import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATES, type StateKey } from "@/lib/constants";
import { Activity, AlertTriangle, CheckCircle, Package } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Requirement {
  id: string;
  title: string;
  current_state: string;
  priority: string;
  source_type: string;
  gap_flags: string[];
  created_at: string;
}

interface Transition {
  id: string;
  from_state: string;
  to_state: string;
  created_at: string;
  requirement_id: string;
}

const Dashboard = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [reqRes, transRes] = await Promise.all([
        supabase.from("requirements").select("*").order("created_at", { ascending: false }),
        supabase.from("state_transitions").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      setRequirements((reqRes.data as Requirement[]) || []);
      setTransitions((transRes.data as Transition[]) || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const totalCount = requirements.length;
  const p1Active = requirements.filter((r) => r.priority === "P1" && r.current_state !== "H-DOE-5").length;
  const productionReady = requirements.filter((r) => r.current_state === "H-DOE-5").length;
  const stuckItems = requirements.filter((r) => {
    const created = new Date(r.created_at);
    const daysSince = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return r.current_state === "S1" && daysSince > 14;
  }).length;

  // Group requirements by state for pipeline
  const stateCounts: Record<string, number> = {};
  Object.keys(STATES).forEach((s) => (stateCounts[s] = 0));
  requirements.forEach((r) => {
    if (stateCounts[r.current_state] !== undefined) stateCounts[r.current_state]++;
  });

  const maxCount = Math.max(...Object.values(stateCounts), 1);

  const stats = [
    { label: "Total Requirements", value: totalCount, icon: Package, color: "text-primary" },
    { label: "P1 Active", value: p1Active, icon: AlertTriangle, color: "text-warning" },
    { label: "Production-Ready", value: productionReady, icon: CheckCircle, color: "text-success" },
    { label: "Stuck (>14d)", value: stuckItems, icon: Activity, color: "text-destructive" },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Pipeline Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          STRIDE COE requirement pipeline overview
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="shadow-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-2.5 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Funnel */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-lg">Pipeline Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(STATES).map(([key, state]) => {
              const count = stateCounts[key] || 0;
              const width = maxCount > 0 ? Math.max((count / maxCount) * 100, 4) : 4;
              const bgColor =
                state.color === "info" ? "bg-info" :
                state.color === "warning" ? "bg-warning" :
                state.color === "accent" ? "bg-accent" :
                state.color === "secondary" ? "bg-secondary" :
                "bg-success";
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-20 text-xs font-medium text-muted-foreground shrink-0">{key}</span>
                  <div className="flex-1 h-7 bg-muted rounded overflow-hidden">
                    <div
                      className={`h-full ${bgColor} rounded flex items-center px-2 transition-all duration-500`}
                      style={{ width: `${width}%` }}
                    >
                      {count > 0 && (
                        <span className="text-[11px] font-bold text-primary-foreground">{count}</span>
                      )}
                    </div>
                  </div>
                  <span className="w-24 text-[11px] text-muted-foreground truncate">{state.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity Feed */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {transitions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transitions yet.</p>
            ) : (
              <div className="space-y-3">
                {transitions.slice(0, 10).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 text-sm">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1">
                      <Badge variant="outline" className="text-[10px] mr-1">{t.from_state}</Badge>
                      →
                      <Badge variant="outline" className="text-[10px] ml-1">{t.to_state}</Badge>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* New Ingestion Queue */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-lg">New Ingestion Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {requirements.filter((r) => r.current_state === "S1").length === 0 ? (
              <p className="text-sm text-muted-foreground">No new requirements in queue.</p>
            ) : (
              <div className="space-y-3">
                {requirements
                  .filter((r) => r.current_state === "S1")
                  .slice(0, 8)
                  .map((r) => (
                    <div key={r.id} className="flex items-center gap-3 text-sm">
                      <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate font-medium">{r.title}</span>
                      <div className="flex gap-1">
                        <Badge variant="secondary" className="text-[10px]">{r.source_type}</Badge>
                        {r.gap_flags?.includes("RED") && (
                          <Badge className="bg-destructive text-destructive-foreground text-[10px]">RED</Badge>
                        )}
                        {r.gap_flags?.includes("BLUE") && (
                          <Badge className="bg-info text-info-foreground text-[10px]">BLUE</Badge>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
