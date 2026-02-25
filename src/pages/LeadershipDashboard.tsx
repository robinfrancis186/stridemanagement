import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATES, type StateKey, SOURCE_TYPES, PRIORITIES, TECH_LEVELS, THERAPY_DOMAINS } from "@/lib/constants";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line,
} from "recharts";
import { BarChart3, Activity, Clock, TrendingUp, DollarSign, ShieldCheck } from "lucide-react";

interface Requirement {
  id: string;
  title: string;
  current_state: string;
  priority: string;
  source_type: string;
  tech_level: string;
  therapy_domains: string[];
  market_price: number | null;
  stride_target_price: number | null;
  created_at: string;
  updated_at: string;
}

interface Transition {
  id: string;
  from_state: string;
  to_state: string;
  created_at: string;
  requirement_id: string;
}

const PHASE_COLORS = {
  SENSING: "hsl(200, 80%, 50%)",
  HARMONIZING: "hsl(36, 95%, 55%)",
  DESIGNATHON: "hsl(280, 60%, 55%)",
  CONVERGENCE: "hsl(160, 60%, 42%)",
};

const PIE_COLORS = ["hsl(220, 72%, 50%)", "hsl(160, 60%, 42%)", "hsl(36, 95%, 55%)", "hsl(0, 72%, 51%)", "hsl(200, 80%, 50%)", "hsl(280, 60%, 55%)"];

const LeadershipDashboard = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [reqRes, transRes] = await Promise.all([
        supabase.from("requirements").select("*"),
        supabase.from("state_transitions").select("*").order("created_at", { ascending: true }),
      ]);
      setRequirements((reqRes.data as Requirement[]) || []);
      setTransitions((transRes.data as Transition[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading analytics...</div>;

  // Pipeline Health - grouped by phase
  const phaseGroups: Record<string, number> = { SENSING: 0, HARMONIZING: 0, DESIGNATHON: 0, CONVERGENCE: 0 };
  requirements.forEach(r => {
    const state = STATES[r.current_state as StateKey];
    if (state) phaseGroups[state.phase] = (phaseGroups[state.phase] || 0) + 1;
  });
  const pipelineData = Object.entries(phaseGroups).map(([phase, count]) => ({ phase, count }));

  // Source Distribution
  const sourceCounts: Record<string, number> = {};
  SOURCE_TYPES.forEach(s => sourceCounts[s] = 0);
  requirements.forEach(r => { sourceCounts[r.source_type] = (sourceCounts[r.source_type] || 0) + 1; });
  const sourceData = Object.entries(sourceCounts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  // Priority Breakdown
  const priorityData = PRIORITIES.map(p => ({
    priority: p,
    ...Object.fromEntries(Object.entries(phaseGroups).map(([phase]) => [phase, 0])),
  })) as Array<{ priority: string } & Record<string, number>>;
  requirements.forEach(r => {
    const state = STATES[r.current_state as StateKey];
    if (!state) return;
    const pd = priorityData.find(p => p.priority === r.priority);
    if (pd) pd[state.phase] = (pd[state.phase] || 0) + 1;
  });

  // Tech Level
  const techData = TECH_LEVELS.map(t => ({ level: t, count: requirements.filter(r => r.tech_level === t).length }));

  // Therapy Domain Radar
  const domainData = THERAPY_DOMAINS.map(d => ({
    domain: d,
    count: requirements.filter(r => r.therapy_domains?.includes(d)).length,
  }));

  // Aging Heatmap
  const agingStates = Object.keys(STATES);
  const agingBuckets = ["< 7d", "7–14d", "14–30d", "30d+"];
  const agingData = agingStates.map(state => {
    const reqs = requirements.filter(r => r.current_state === state);
    const buckets = [0, 0, 0, 0];
    reqs.forEach(r => {
      const days = (Date.now() - new Date(r.updated_at).getTime()) / 86400000;
      if (days < 7) buckets[0]++;
      else if (days < 14) buckets[1]++;
      else if (days < 30) buckets[2]++;
      else buckets[3]++;
    });
    return { state, ...Object.fromEntries(agingBuckets.map((b, i) => [b, buckets[i]])) } as { state: string } & Record<string, number>;
  });
  // Only show states with at least 1 requirement
  const filteredAgingData = agingData.filter(d => {
    const total = agingBuckets.reduce((sum, b) => sum + (d[b] || 0), 0);
    return total > 0;
  });

  // Cost Impact
  const costReqs = requirements.filter(r => r.market_price && r.stride_target_price);
  const totalMarket = costReqs.reduce((s, r) => s + (r.market_price || 0), 0);
  const totalStride = costReqs.reduce((s, r) => s + (r.stride_target_price || 0), 0);
  const totalSavings = totalMarket - totalStride;

  // Monthly throughput (simple: group by month)
  const monthlyIn: Record<string, number> = {};
  const monthlyOut: Record<string, number> = {};
  requirements.forEach(r => {
    const m = r.created_at.slice(0, 7);
    monthlyIn[m] = (monthlyIn[m] || 0) + 1;
  });
  requirements.filter(r => r.current_state === "H-DOE-5").forEach(r => {
    const m = r.updated_at.slice(0, 7);
    monthlyOut[m] = (monthlyOut[m] || 0) + 1;
  });
  const allMonths = [...new Set([...Object.keys(monthlyIn), ...Object.keys(monthlyOut)])].sort();
  const throughputData = allMonths.map(m => ({ month: m, Entered: monthlyIn[m] || 0, "Production-Ready": monthlyOut[m] || 0 }));

  const productionReady = requirements.filter(r => r.current_state === "H-DOE-5").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Leadership Dashboard</h1>
        <p className="text-sm text-muted-foreground">Read-only analytics and pipeline health overview</p>
      </div>

      {/* Top Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Pipeline", value: requirements.length, icon: BarChart3, color: "text-primary" },
          { label: "Production-Ready", value: productionReady, icon: ShieldCheck, color: "text-success" },
          { label: "Cost Savings", value: totalSavings > 0 ? `$${totalSavings.toLocaleString()}` : "—", icon: DollarSign, color: "text-secondary" },
          { label: "Devices Costed", value: costReqs.length, icon: TrendingUp, color: "text-accent" },
        ].map(s => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-2.5 ${s.color}`}><s.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold font-display text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline Health */}
        <Card className="shadow-card">
          <CardHeader><CardTitle className="font-display text-base">Pipeline Health by Phase</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="phase" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {pipelineData.map((entry, i) => (
                      <Cell key={i} fill={PHASE_COLORS[entry.phase as keyof typeof PHASE_COLORS] || "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Source Distribution */}
        <Card className="shadow-card">
          <CardHeader><CardTitle className="font-display text-base">Source Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {sourceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Therapy Domain Radar */}
        <Card className="shadow-card">
          <CardHeader><CardTitle className="font-display text-base">Therapy Domain Coverage</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={domainData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="domain" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Radar dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tech Level */}
        <Card className="shadow-card">
          <CardHeader><CardTitle className="font-display text-base">Tech Level Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={techData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="level" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Throughput */}
        <Card className="shadow-card lg:col-span-2">
          <CardHeader><CardTitle className="font-display text-base">Monthly Throughput</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              {throughputData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={throughputData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Entered" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Production-Ready" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">No monthly data yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aging Heatmap */}
      {filteredAgingData.length > 0 && (
        <Card className="shadow-card">
          <CardHeader><CardTitle className="font-display text-base">Aging Heatmap</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-muted-foreground">State</th>
                    {agingBuckets.map(b => <th key={b} className="p-2 text-muted-foreground">{b}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredAgingData.map(row => (
                    <tr key={row.state}>
                      <td className="p-2 font-medium">{row.state}</td>
                      {agingBuckets.map(b => {
                        const v = (row as Record<string, number>)[b] || 0;
                        const bg = v === 0 ? "" : b === "< 7d" ? "bg-success/20" : b === "7–14d" ? "bg-warning/20" : b === "14–30d" ? "bg-warning/40" : "bg-destructive/30";
                        return <td key={b} className={`p-2 text-center rounded ${bg}`}>{v || "—"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Impact */}
      {costReqs.length > 0 && (
        <Card className="shadow-card">
          <CardHeader><CardTitle className="font-display text-base">Cost Impact Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3 text-center">
              <div>
                <p className="text-2xl font-bold font-display text-foreground">${totalMarket.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Market Price</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-secondary">${totalStride.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total STRIDE Price</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-success">${totalSavings.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Cumulative Savings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LeadershipDashboard;
