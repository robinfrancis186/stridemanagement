import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATES, type StateKey } from "@/lib/constants";
import { getNextStates, isTerminalState, isPathAssignmentRequired } from "@/lib/stateMachine";
import PhaseFeedbackModal, { type FeedbackData } from "@/components/PhaseFeedbackModal";
import PathAssignmentModal from "@/components/PathAssignmentModal";
import DoETab from "@/components/DoETab";
import CommitteeReviewPanel from "@/components/CommitteeReviewPanel";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Clock, CheckCircle, ChevronRight, FileText, AlertTriangle, FlaskConical, Users } from "lucide-react";
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

interface PhaseFeedback {
  id: string;
  from_state: string;
  to_state: string;
  phase_notes: string | null;
  blockers_resolved: string[] | null;
  key_decisions: string[] | null;
  phase_specific_data: Record<string, string> | null;
  created_at: string;
  submitted_by: string | null;
}

const RequirementDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const [req, setReq] = useState<Requirement | null>(null);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [feedbacks, setFeedbacks] = useState<PhaseFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [pathOpen, setPathOpen] = useState(false);
  const [selectedNextState, setSelectedNextState] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [reqRes, transRes, fbRes] = await Promise.all([
      supabase.from("requirements").select("*").eq("id", id).single(),
      supabase.from("state_transitions").select("*").eq("requirement_id", id).order("created_at", { ascending: true }),
      supabase.from("phase_feedbacks").select("*").eq("requirement_id", id).order("created_at", { ascending: true }),
    ]);
    setReq(reqRes.data as Requirement | null);
    setTransitions((transRes.data as Transition[]) || []);
    setFeedbacks((fbRes.data as PhaseFeedback[]) || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  if (!req) return <div className="py-12 text-center text-muted-foreground">Requirement not found.</div>;

  const si = STATES[req.current_state as StateKey] || { label: req.current_state, phase: "", color: "muted" };
  const isAdmin = role === "coe_admin";
  const nextStates = getNextStates(req.current_state, req.path_assignment);
  const terminal = isTerminalState(req.current_state);
  const needsPath = isPathAssignmentRequired(req.current_state) && !req.path_assignment;

  // Data completeness
  const fields = [req.title, req.description, req.source_type, req.priority, req.tech_level, req.disability_types?.length, req.therapy_domains?.length, req.market_price, req.stride_target_price];
  const completeness = Math.round((fields.filter(Boolean).length / fields.length) * 100);

  const handleAdvanceClick = (toState: string) => {
    if (needsPath) {
      setPathOpen(true);
      return;
    }
    setSelectedNextState(toState);
    setFeedbackOpen(true);
  };

  const handlePathAssign = async (path: "INTERNAL" | "DESIGNATHON", justification: string) => {
    setSubmitting(true);
    const { error } = await supabase.from("requirements").update({ path_assignment: path }).eq("id", req.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }
    // Auto-set next state based on path
    const nextState = path === "INTERNAL" ? "H-INT-1" : "H-DES-1";
    setReq({ ...req, path_assignment: path });
    setPathOpen(false);
    setSubmitting(false);
    // Now open feedback for the transition
    setSelectedNextState(nextState);
    setFeedbackOpen(true);
  };

  const handleFeedbackSubmit = async (data: FeedbackData) => {
    setSubmitting(true);
    const fromState = req.current_state;
    const toState = selectedNextState;

    // Insert feedback
    const { error: fbErr } = await supabase.from("phase_feedbacks").insert({
      requirement_id: req.id,
      from_state: fromState,
      to_state: toState,
      phase_notes: data.phaseNotes,
      blockers_resolved: data.blockersResolved,
      key_decisions: data.keyDecisions,
      phase_specific_data: data.phaseSpecificData,
      submitted_by: user?.id,
    });

    if (fbErr) {
      toast({ title: "Error saving feedback", description: fbErr.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Insert transition
    const { error: trErr } = await supabase.from("state_transitions").insert({
      requirement_id: req.id,
      from_state: fromState,
      to_state: toState,
      transitioned_by: user?.id,
      notes: data.phaseNotes.slice(0, 200),
    });

    if (trErr) {
      toast({ title: "Error recording transition", description: trErr.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Update requirement state (and increment revision if revision loop)
    const isRevision = (toState === "H-INT-1" || toState === "H-DES-1") && fromState === "H-DOE-4";
    const { error: reqErr } = await supabase.from("requirements").update({
      current_state: toState,
      ...(isRevision ? { revision_number: req.revision_number + 1 } : {}),
    }).eq("id", req.id);

    if (reqErr) {
      toast({ title: "Error updating state", description: reqErr.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    toast({ title: "State Advanced", description: `Transitioned from ${fromState} to ${toState}` });
    setFeedbackOpen(false);
    setSubmitting(false);
    fetchData(); // Refresh
  };

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
            {req.revision_number > 0 && <Badge variant="outline" className="text-warning">Rev #{req.revision_number}</Badge>}
          </div>
        </div>
      </div>

      {/* Advance State Bar */}
      {isAdmin && !terminal && (
        <Card className="shadow-card border-primary/20">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-foreground">Advance State:</span>
            {needsPath ? (
              <Button size="sm" onClick={() => setPathOpen(true)}>
                <ChevronRight className="mr-1.5 h-3.5 w-3.5" />
                Assign Path & Advance
              </Button>
            ) : nextStates.length > 0 ? (
              nextStates.map((ns) => {
                const nsInfo = STATES[ns as StateKey];
                const isRevision = (ns === "H-INT-1" || ns === "H-DES-1") && req.current_state === "H-DOE-4";
                return (
                  <Button
                    key={ns}
                    size="sm"
                    variant={isRevision ? "outline" : "default"}
                    onClick={() => handleAdvanceClick(ns)}
                  >
                    {isRevision ? (
                      <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                    ) : (
                      <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {isRevision ? `Revision → ${ns}` : `${ns} — ${nsInfo?.label || ns}`}
                  </Button>
                );
              })
            ) : null}
          </CardContent>
        </Card>
      )}

      {terminal && (
        <Card className="shadow-card border-success/30 bg-success/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-success" />
            <span className="text-sm font-medium text-success">This requirement is Production-Ready.</span>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="feedback">Feedback ({feedbacks.length})</TabsTrigger>
          <TabsTrigger value="doe" className="flex items-center gap-1.5">
            <FlaskConical className="h-3 w-3" />DoE
          </TabsTrigger>
          <TabsTrigger value="committee" className="flex items-center gap-1.5">
            <Users className="h-3 w-3" />Committee
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
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
                <div className="flex justify-between"><span className="text-muted-foreground">Path</span><span>{req.path_assignment || "Not assigned"}</span></div>
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
                  {transitions.map((t) => (
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
                          <span className="text-[11px] text-muted-foreground">{format(new Date(t.created_at), "PPp")}</span>
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

        <TabsContent value="feedback" className="space-y-4">
          {feedbacks.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                No phase feedback recorded yet. Feedback is captured each time the state advances.
              </CardContent>
            </Card>
          ) : (
            feedbacks.map((fb) => {
              const fromLabel = STATES[fb.from_state as StateKey]?.label || fb.from_state;
              const toLabel = STATES[fb.to_state as StateKey]?.label || fb.to_state;
              return (
                <Card key={fb.id} className="shadow-card">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <CardTitle className="font-display text-sm">
                          {fb.from_state} → {fb.to_state}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">
                          ({fromLabel} → {toLabel})
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(fb.created_at), "PPp")}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {fb.phase_notes && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Phase Notes</p>
                        <p className="text-foreground whitespace-pre-wrap">{fb.phase_notes}</p>
                      </div>
                    )}
                    {fb.blockers_resolved && fb.blockers_resolved.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Blockers Resolved</p>
                        <div className="flex flex-wrap gap-1">
                          {fb.blockers_resolved.map((b, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{b}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {fb.key_decisions && fb.key_decisions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Key Decisions</p>
                        <div className="flex flex-wrap gap-1">
                          {fb.key_decisions.map((d, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {fb.phase_specific_data && Object.keys(fb.phase_specific_data).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Phase-Specific Data</p>
                        <div className="grid gap-1 text-xs">
                          {Object.entries(fb.phase_specific_data).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}:</span>
                              <span className="text-foreground">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="doe">
          <DoETab requirementId={req.id} currentState={req.current_state} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="committee">
          <CommitteeReviewPanel requirementId={req.id} currentState={req.current_state} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <PhaseFeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        fromState={req.current_state}
        toState={selectedNextState}
        onSubmit={handleFeedbackSubmit}
        loading={submitting}
      />
      <PathAssignmentModal
        open={pathOpen}
        onOpenChange={setPathOpen}
        onSubmit={handlePathAssign}
        loading={submitting}
      />
    </div>
  );
};

export default RequirementDetail;
