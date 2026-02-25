import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ClipboardCheck, Gavel, Send, Users } from "lucide-react";
import { format } from "date-fns";

interface CommitteeReview {
  id: string;
  reviewer_id: string;
  user_need_score: number;
  technical_feasibility_score: number;
  doe_results_score: number;
  cost_effectiveness_score: number;
  safety_score: number;
  weighted_total: number;
  feedback_text: string | null;
  recommendation: string;
  conditions: string | null;
  created_at: string;
}

interface CommitteeDecision {
  id: string;
  decision: string;
  revision_instructions: string | null;
  conditions: string | null;
  decided_by: string;
  created_at: string;
}

const WEIGHTS = { user_need: 0.25, technical_feasibility: 0.20, doe_results: 0.25, cost_effectiveness: 0.15, safety: 0.15 };

const CommitteeReviewPanel = ({ requirementId, currentState, isAdmin }: { requirementId: string; currentState: string; isAdmin: boolean }) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<CommitteeReview[]>([]);
  const [decision, setDecision] = useState<CommitteeDecision | null>(null);
  const [loading, setLoading] = useState(true);

  // Scoring form
  const [userNeed, setUserNeed] = useState(5);
  const [techFeasibility, setTechFeasibility] = useState(5);
  const [doeResults, setDoeResults] = useState(5);
  const [costEff, setCostEff] = useState(5);
  const [safety, setSafety] = useState(5);
  const [feedbackText, setFeedbackText] = useState("");
  const [recommendation, setRecommendation] = useState<string>("");
  const [conditions, setConditions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Decision form
  const [decisionChoice, setDecisionChoice] = useState<string>("");
  const [revisionInstructions, setRevisionInstructions] = useState("");
  const [decisionConditions, setDecisionConditions] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const [revRes, decRes] = await Promise.all([
        supabase.from("committee_reviews").select("*").eq("requirement_id", requirementId).order("created_at"),
        supabase.from("committee_decisions").select("*").eq("requirement_id", requirementId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setReviews((revRes.data as CommitteeReview[]) || []);
      setDecision(decRes.data as CommitteeDecision | null);
      setLoading(false);
    };
    fetch();
  }, [requirementId]);

  const weightedTotal = (
    userNeed * WEIGHTS.user_need +
    techFeasibility * WEIGHTS.technical_feasibility +
    doeResults * WEIGHTS.doe_results +
    costEff * WEIGHTS.cost_effectiveness +
    safety * WEIGHTS.safety
  );

  const handleSubmitReview = async () => {
    if (!recommendation) {
      toast({ title: "Required", description: "Please select a recommendation.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("committee_reviews").insert({
      requirement_id: requirementId,
      reviewer_id: user?.id,
      user_need_score: userNeed,
      technical_feasibility_score: techFeasibility,
      doe_results_score: doeResults,
      cost_effectiveness_score: costEff,
      safety_score: safety,
      weighted_total: Math.round(weightedTotal * 10) / 10,
      feedback_text: feedbackText || null,
      recommendation,
      conditions: conditions || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Review Submitted" });
      // Refresh
      const { data } = await supabase.from("committee_reviews").select("*").eq("requirement_id", requirementId).order("created_at");
      setReviews((data as CommitteeReview[]) || []);
    }
    setSubmitting(false);
  };

  const handleSubmitDecision = async () => {
    if (!decisionChoice) return;
    setSubmitting(true);
    const { error } = await supabase.from("committee_decisions").insert({
      requirement_id: requirementId,
      decision: decisionChoice,
      revision_instructions: revisionInstructions || null,
      conditions: decisionConditions || null,
      decided_by: user?.id!,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Decision Recorded" });
      const { data } = await supabase.from("committee_decisions").select("*").eq("requirement_id", requirementId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      setDecision(data as CommitteeDecision | null);
    }
    setSubmitting(false);
  };

  const isCommitteePhase = currentState === "H-DOE-3" || currentState === "H-DOE-4";

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading...</div>;

  const ScoreSlider = ({ label, weight, value, onChange }: { label: string; weight: string; value: number; onChange: (v: number) => void }) => (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span>{label} <span className="text-muted-foreground">({weight})</span></span>
        <span className="font-bold text-primary">{value}/10</span>
      </div>
      <Slider min={0} max={10} step={0.5} value={[value]} onValueChange={([v]) => onChange(v)} disabled={!isAdmin} />
    </div>
  );

  return (
    <div className="space-y-4">
      {!isCommitteePhase && !decision && reviews.length === 0 && (
        <Card className="shadow-card border-warning/30 bg-warning/5">
          <CardContent className="p-4 text-sm text-warning">
            Committee review is available at H-DOE-3 (Committee Review) and H-DOE-4 (Committee Decision).
          </CardContent>
        </Card>
      )}

      {/* Existing Decision */}
      {decision && (
        <Card className={`shadow-card border-2 ${decision.decision === "APPROVE" ? "border-success/40 bg-success/5" : decision.decision === "REJECT" ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5"}`}>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm flex items-center gap-2">
              <Gavel className="h-4 w-4" />
              Committee Decision
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Badge className={decision.decision === "APPROVE" ? "bg-success text-success-foreground" : decision.decision === "REJECT" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}>
              {decision.decision}
            </Badge>
            {decision.conditions && <p><span className="text-muted-foreground">Conditions:</span> {decision.conditions}</p>}
            {decision.revision_instructions && <p><span className="text-muted-foreground">Revision Instructions:</span> {decision.revision_instructions}</p>}
            <p className="text-xs text-muted-foreground">{format(new Date(decision.created_at), "PPp")}</p>
          </CardContent>
        </Card>
      )}

      {/* Existing Reviews */}
      {reviews.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Member Reviews ({reviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className={r.recommendation === "APPROVE" ? "bg-success text-success-foreground" : r.recommendation === "REJECT" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}>
                    {r.recommendation}
                  </Badge>
                  <span className="text-xs font-bold text-primary">Score: {r.weighted_total}/10</span>
                </div>
                <div className="grid grid-cols-5 gap-2 text-[11px] text-muted-foreground">
                  <span>Need: {r.user_need_score}</span>
                  <span>Tech: {r.technical_feasibility_score}</span>
                  <span>DoE: {r.doe_results_score}</span>
                  <span>Cost: {r.cost_effectiveness_score}</span>
                  <span>Safety: {r.safety_score}</span>
                </div>
                {r.feedback_text && <p className="text-xs">{r.feedback_text}</p>}
                <p className="text-[11px] text-muted-foreground">{format(new Date(r.created_at), "PPp")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Scoring Form */}
      {isAdmin && isCommitteePhase && (
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-sm flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Submit Review
              <span className="ml-auto text-xs font-bold text-primary">Weighted: {weightedTotal.toFixed(1)}/10</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScoreSlider label="User Need" weight="25%" value={userNeed} onChange={setUserNeed} />
            <ScoreSlider label="Technical Feasibility" weight="20%" value={techFeasibility} onChange={setTechFeasibility} />
            <ScoreSlider label="DoE Results" weight="25%" value={doeResults} onChange={setDoeResults} />
            <ScoreSlider label="Cost Effectiveness" weight="15%" value={costEff} onChange={setCostEff} />
            <ScoreSlider label="Safety" weight="15%" value={safety} onChange={setSafety} />

            <div>
              <Label className="text-xs">Feedback</Label>
              <Textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Detailed feedback..." className="mt-1 text-sm" rows={3} />
            </div>

            <div>
              <Label className="text-xs">Recommendation</Label>
              <Select value={recommendation} onValueChange={setRecommendation}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVE">APPROVE</SelectItem>
                  <SelectItem value="REVISE">REVISE</SelectItem>
                  <SelectItem value="REJECT">REJECT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Conditions (optional)</Label>
              <Textarea value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Conditions for approval..." className="mt-1 text-sm" rows={2} />
            </div>

            <Button onClick={handleSubmitReview} disabled={submitting} className="w-full">
              <Send className="mr-2 h-4 w-4" />
              {submitting ? "Submitting..." : "Submit Review"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Decision Panel (Chair) */}
      {isAdmin && currentState === "H-DOE-4" && !decision && reviews.length > 0 && (
        <Card className="shadow-card border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-sm flex items-center gap-2">
              <Gavel className="h-4 w-4 text-primary" />
              Consolidated Decision (Chair)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Decision</Label>
              <Select value={decisionChoice} onValueChange={setDecisionChoice}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select decision..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVE">APPROVE → Production-Ready</SelectItem>
                  <SelectItem value="REVISE">REVISE → Send Back for Revision</SelectItem>
                  <SelectItem value="REJECT">REJECT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {decisionChoice === "REVISE" && (
              <div>
                <Label className="text-xs">Revision Instructions</Label>
                <Textarea value={revisionInstructions} onChange={(e) => setRevisionInstructions(e.target.value)} placeholder="What needs to be revised..." className="mt-1 text-sm" rows={3} />
              </div>
            )}
            <div>
              <Label className="text-xs">Conditions (optional)</Label>
              <Textarea value={decisionConditions} onChange={(e) => setDecisionConditions(e.target.value)} className="mt-1 text-sm" rows={2} />
            </div>
            <Button onClick={handleSubmitDecision} disabled={submitting || !decisionChoice} className="w-full">
              <Gavel className="mr-2 h-4 w-4" />
              {submitting ? "Recording..." : "Record Decision"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CommitteeReviewPanel;
