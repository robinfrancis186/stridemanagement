import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATES, type StateKey } from "@/lib/constants";
import { ArrowLeft, Clock, CheckCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Requirement {
  id: string;
  title: string;
  description: string | null;
  source_type: string;
  priority: string;
  tech_level: string;
  disability_types: string[];
  therapy_domains: string[];
  market_price: number | null;
  stride_target_price: number | null;
  gap_flags: string[];
  current_state: string;
  path_assignment: string | null;
  revision_number: number;
  created_at: string;
  updated_at: string;
}

interface Transition {
  id: string;
  from_state: string;
  to_state: string;
  notes: string | null;
  created_at: string;
}

const RequirementDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [req, setReq] = useState<Requirement | null>(null);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const [reqRes, transRes] = await Promise.all([
        supabase.from("requirements").select("*").eq("id", id).single(),
        supabase.from("state_transitions").select("*").eq("requirement_id", id).order("created_at", { ascending: true }),
      ]);
      setReq(reqRes.data as Requirement | null);
      setTransitions((transRes.data as Transition[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  if (!req) return <div className="py-12 text-center text-muted-foreground">Requirement not found.</div>;

  const si = STATES[req.current_state as StateKey] || { label: req.current_state, phase: "", color: "muted" };

  // Calculate data completeness
  const fields = [
    req.title, req.description, req.source_type, req.priority, req.tech_level,
    req.disability_types?.length, req.therapy_domains?.length, req.market_price, req.stride_target_price,
  ];
  const filled = fields.filter(Boolean).length;
  const completeness = Math.round((filled / fields.length) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link to="/requirements">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-foreground">{req.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="outline">{req.current_state} — {si.label}</Badge>
            <Badge className={req.priority === "P1" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}>
              {req.priority}
            </Badge>
            <Badge variant="secondary">{req.source_type}</Badge>
            <Badge variant="secondary">{req.tech_level}</Badge>
            {req.path_assignment && <Badge variant="outline">{req.path_assignment}</Badge>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Completeness bar */}
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Data Completeness</span>
                <span className="text-sm font-bold text-primary">{completeness}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${completeness}%` }} />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader><CardTitle className="font-display text-base">Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Description</span><span className="text-right max-w-[60%]">{req.description || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span>{req.source_type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Priority</span><span>{req.priority}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tech Level</span><span>{req.tech_level}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Revision</span><span>#{req.revision_number}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{format(new Date(req.created_at), "PPp")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span>{format(new Date(req.updated_at), "PPp")}</span></div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader><CardTitle className="font-display text-base">Classification</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Disability Types</p>
                  <div className="flex flex-wrap gap-1">
                    {req.disability_types?.length ? req.disability_types.map((d) => (
                      <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>
                    )) : <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Therapy Domains</p>
                  <div className="flex flex-wrap gap-1">
                    {req.therapy_domains?.length ? req.therapy_domains.map((d) => (
                      <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>
                    )) : <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Gap Flags</p>
                  <div className="flex flex-wrap gap-1">
                    {req.gap_flags?.length ? req.gap_flags.map((g) => (
                      <Badge key={g} className={g === "RED" ? "bg-destructive text-destructive-foreground text-[10px]" : "bg-info text-info-foreground text-[10px]"}>
                        {g}
                      </Badge>
                    )) : <span className="text-muted-foreground">None</span>}
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Market Price</span><span>{req.market_price ? `$${req.market_price}` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">STRIDE Target</span><span>{req.stride_target_price ? `$${req.stride_target_price}` : "—"}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-display text-base">State Timeline</CardTitle></CardHeader>
            <CardContent>
              {transitions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No state transitions yet.</p>
              ) : (
                <div className="relative pl-6 space-y-6">
                  <div className="absolute left-2.5 top-1 bottom-1 w-px bg-border" />
                  {transitions.map((t, i) => (
                    <div key={t.id} className="relative">
                      <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <CheckCircle className="h-3 w-3 text-primary-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{t.from_state}</Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge variant="outline" className="text-[10px]">{t.to_state}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(t.created_at), "PPp")}
                          </span>
                        </div>
                        {t.notes && <p className="mt-1 text-sm text-muted-foreground">{t.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RequirementDetail;
