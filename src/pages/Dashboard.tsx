import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATES, type StateKey } from "@/lib/constants";
import { Activity, AlertTriangle, CheckCircle, Package, Clock, Timer } from "lucide-react";
import { formatDistanceToNow, differenceInDays } from "date-fns";

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
  const [allTransitions, setAllTransitions] = useState<Transition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reqRes, recentTransRes, allTransRes] = await Promise.all([
          supabase.from("requirements").select("*").order("created_at", { ascending: false }),
          supabase.from("state_transitions").select("*").order("created_at", { ascending: false }).limit(20),
          supabase.from("state_transitions").select("*").order("created_at", { ascending: false }),
        ]);

        setRequirements((reqRes.data as Requirement[]) || []);
        setTransitions((recentTransRes.data as Transition[]) || []);
        setAllTransitions((allTransRes.data as Transition[]) || []);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        setRequirements([]);
        setTransitions([]);
        setAllTransitions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalCount = requirements.length;
  const p1Active = requirements.filter((r) => r.priority === "P1" && r.current_state !== "H-DOE-5").length;
  const productionReady = requirements.filter((r) => r.current_state === "H-DOE-5").length;
  const agingThresholds: Record<string, number> = {
    S: 14, "H-INT": 60, "H-DES": 90, "H-DOE": 45,
  };

  const getPhasePrefix = (state: string) => {
    if (state.startsWith("H-DOE")) return "H-DOE";
    if (state.startsWith("H-DES")) return "H-DES";
    if (state.startsWith("H-INT")) return "H-INT";
    if (state.startsWith("S")) return "S";
    return "";
  };

  const getThreshold = (state: string) => agingThresholds[getPhasePrefix(state)] || 30;

  const agingItems = requirements
    .filter((r) => r.current_state !== "H-DOE-5")
    .map((r) => {
      const lastTransition = allTransitions.find((t) => t.requirement_id === r.id);
      const sinceDate = lastTransition ? new Date(lastTransition.created_at) : new Date(r.created_at);
      const daysInPhase = differenceInDays(new Date(), sinceDate);
      const threshold = getThreshold(r.current_state);
      const overdue = daysInPhase - threshold;
      return { ...r, daysInPhase, threshold, overdue, sinceDate };
    })
    .filter((r) => r.overdue > 0)
    .sort((a, b) => b.overdue - a.overdue);

  const stuckItems = agingItems.length;

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

      {/* Aging Alerts */}
      <Card className={`shadow-card ${agingItems.length > 0 ? "border-destructive/30" : "border-success/30"}`}>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Timer className={`h-5 w-5 ${agingItems.length > 0 ? "text-destructive" : "text-success"}`} />
            Aging Alerts ({agingItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agingItems.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle className="h-4 w-4" />
              <span>All requirements are within acceptable phase timelines.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {agingItems.slice(0, 10).map((item) => {
                const severity = item.overdue > 30 ? "destructive" : item.overdue > 14 ? "warning" : "secondary";
                const si = STATES[item.current_state as StateKey];
                return (
                  <Link
                    key={item.id}
                    to={`/requirements/${item.id}`}
                    className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <AlertTriangle className={`h-4 w-4 shrink-0 ${
                      severity === "destructive" ? "text-destructive" :
                      severity === "warning" ? "text-warning" : "text-muted-foreground"
                    }`} />
                    <span className="flex-1 font-medium truncate">{item.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {item.current_state} — {si?.label || item.current_state}
                    </Badge>
                    <Badge className={`text-[10px] ${
                      severity === "destructive" ? "bg-destructive text-destructive-foreground" :
                      severity === "warning" ? "bg-warning text-warning-foreground" : "bg-secondary text-secondary-foreground"
                    }`}>
                      {item.daysInPhase}d / {item.threshold}d limit
                    </Badge>
                    <span className="text-xs text-destructive font-medium">+{item.overdue}d overdue</span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
