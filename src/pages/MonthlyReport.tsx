import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATES, type StateKey, SOURCE_TYPES } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format } from "date-fns";
import { Calendar, Package, TrendingUp, DollarSign } from "lucide-react";

interface Requirement {
  id: string;
  title: string;
  current_state: string;
  priority: string;
  source_type: string;
  market_price: number | null;
  stride_target_price: number | null;
  created_at: string;
  updated_at: string;
}

const PIE_COLORS = ["hsl(220, 72%, 50%)", "hsl(160, 60%, 42%)", "hsl(36, 95%, 55%)", "hsl(0, 72%, 51%)", "hsl(200, 80%, 50%)", "hsl(280, 60%, 55%)"];

const MonthlyReport = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("requirements").select("*");
      setRequirements((data as Requirement[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const months = useMemo(() => {
    const set = new Set<string>();
    requirements.forEach(r => { set.add(r.created_at.slice(0, 7)); set.add(r.updated_at.slice(0, 7)); });
    return [...set].sort().reverse();
  }, [requirements]);

  const monthReqs = requirements.filter(r =>
    r.created_at.slice(0, 7) <= selectedMonth
  );

  const newThisMonth = requirements.filter(r => r.created_at.slice(0, 7) === selectedMonth);
  const productionReady = monthReqs.filter(r => r.current_state === "H-DOE-5");
  const prodThisMonth = productionReady.filter(r => r.updated_at.slice(0, 7) === selectedMonth);

  const sourceCounts: Record<string, number> = {};
  SOURCE_TYPES.forEach(s => sourceCounts[s] = 0);
  monthReqs.forEach(r => { sourceCounts[r.source_type] = (sourceCounts[r.source_type] || 0) + 1; });
  const sourceData = Object.entries(sourceCounts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  const costReqs = prodThisMonth.filter(r => r.market_price && r.stride_target_price);
  const savings = costReqs.reduce((s, r) => s + ((r.market_price || 0) - (r.stride_target_price || 0)), 0);

  // Pipeline status
  const stateCounts: Record<string, number> = {};
  Object.keys(STATES).forEach(s => stateCounts[s] = 0);
  monthReqs.forEach(r => { if (stateCounts[r.current_state] !== undefined) stateCounts[r.current_state]++; });
  const pipelineData = Object.entries(stateCounts).filter(([, v]) => v > 0).map(([state, count]) => ({ state, count }));

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Monthly Report</h1>
          <p className="text-sm text-muted-foreground">Monthly pipeline summary and archival view</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "New This Month", value: newThisMonth.length, icon: Package, color: "text-primary" },
          { label: "Production-Ready (Month)", value: prodThisMonth.length, icon: TrendingUp, color: "text-success" },
          { label: "Total Pipeline", value: monthReqs.length, icon: Calendar, color: "text-info" },
          { label: "Cost Savings (Month)", value: savings > 0 ? `$${savings.toLocaleString()}` : "—", icon: DollarSign, color: "text-secondary" },
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
        <Card className="shadow-card">
          <CardHeader><CardTitle className="font-display text-base">Pipeline Status</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="state" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

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
      </div>

      {/* Aging Alerts */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="font-display text-base">Aging Alerts</CardTitle></CardHeader>
        <CardContent>
          {(() => {
            const alerts = monthReqs.filter(r => {
              const days = (Date.now() - new Date(r.updated_at).getTime()) / 86400000;
              const state = r.current_state;
              if (state.startsWith("S") && days > 14) return true;
              if (state.startsWith("H-INT") && days > 60) return true;
              if (state.startsWith("H-DES") && days > 90) return true;
              if (state.startsWith("H-DOE") && days > 45) return true;
              return false;
            });
            if (alerts.length === 0) return <p className="text-sm text-muted-foreground">No aging alerts for this period.</p>;
            return (
              <div className="space-y-2">
                {alerts.map(r => {
                  const days = Math.round((Date.now() - new Date(r.updated_at).getTime()) / 86400000);
                  return (
                    <div key={r.id} className="flex items-center gap-3 text-sm border-b pb-2">
                      <Badge variant="outline" className="text-[10px]">{r.current_state}</Badge>
                      <span className="flex-1 truncate">{r.title}</span>
                      <Badge className="bg-destructive text-destructive-foreground text-[10px]">{days}d</Badge>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthlyReport;
