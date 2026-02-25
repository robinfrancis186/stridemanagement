import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { STATES, type StateKey } from "@/lib/constants";
import { getGateCriteria, getPhaseFields, type GateCriterion, type PhaseField } from "@/lib/stateMachine";
import { AlertTriangle, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

interface PhaseFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromState: string;
  toState: string;
  onSubmit: (data: FeedbackData) => Promise<void>;
  loading?: boolean;
}

export interface FeedbackData {
  phaseNotes: string;
  blockersResolved: string[];
  keyDecisions: string[];
  gateCriteriaChecked: Record<string, boolean>;
  phaseSpecificData: Record<string, string>;
}

const PhaseFeedbackModal = ({ open, onOpenChange, fromState, toState, onSubmit, loading }: PhaseFeedbackModalProps) => {
  const [phaseNotes, setPhaseNotes] = useState("");
  const [blockerInput, setBlockerInput] = useState("");
  const [blockersResolved, setBlockersResolved] = useState<string[]>([]);
  const [decisionInput, setDecisionInput] = useState("");
  const [keyDecisions, setKeyDecisions] = useState<string[]>([]);
  const [gateChecked, setGateChecked] = useState<Record<string, boolean>>({});
  const [phaseData, setPhaseData] = useState<Record<string, string>>({});

  const gateCriteria = getGateCriteria(fromState, toState);
  const phaseFields = getPhaseFields(fromState, toState);
  const fromLabel = STATES[fromState as StateKey]?.label || fromState;
  const toLabel = STATES[toState as StateKey]?.label || toState;

  const requiredGatesMet = gateCriteria
    .filter((g) => g.required)
    .every((g) => gateChecked[g.id]);

  const requiredPhaseFieldsMet = phaseFields
    .filter((f) => f.required)
    .every((f) => phaseData[f.id]?.trim());

  const canSubmit = requiredGatesMet && requiredPhaseFieldsMet && phaseNotes.trim().length > 0;

  const addBlocker = () => {
    if (blockerInput.trim()) {
      setBlockersResolved([...blockersResolved, blockerInput.trim()]);
      setBlockerInput("");
    }
  };

  const addDecision = () => {
    if (decisionInput.trim()) {
      setKeyDecisions([...keyDecisions, decisionInput.trim()]);
      setDecisionInput("");
    }
  };

  const handleSubmit = async () => {
    await onSubmit({
      phaseNotes,
      blockersResolved,
      keyDecisions,
      gateCriteriaChecked: gateChecked,
      phaseSpecificData: phaseData,
    });
  };

  const isRevision = toState === "H-INT-1" && fromState === "H-DOE-4" || toState === "H-DES-1" && fromState === "H-DOE-4";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            {isRevision ? (
              <AlertTriangle className="h-5 w-5 text-warning" />
            ) : (
              <ArrowRight className="h-5 w-5 text-primary" />
            )}
            {isRevision ? "Revision Feedback" : "Phase Transition Feedback"}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <Badge variant="outline">{fromState} — {fromLabel}</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline">{toState} — {toLabel}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Gate Criteria Checklist */}
          {gateCriteria.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <Label className="font-display text-sm font-semibold">Gate Criteria</Label>
              </div>
              <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
                {gateCriteria.map((g) => (
                  <label key={g.id} className="flex items-start gap-3 text-sm cursor-pointer">
                    <Checkbox
                      checked={!!gateChecked[g.id]}
                      onCheckedChange={(checked) =>
                        setGateChecked((prev) => ({ ...prev, [g.id]: !!checked }))
                      }
                      className="mt-0.5"
                    />
                    <span className={gateChecked[g.id] ? "text-foreground" : "text-muted-foreground"}>
                      {g.label}
                      {g.required && <span className="text-destructive ml-1">*</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Phase Notes */}
          <div className="space-y-2">
            <Label htmlFor="phase-notes">Phase Notes <span className="text-destructive">*</span></Label>
            <Textarea
              id="phase-notes"
              value={phaseNotes}
              onChange={(e) => setPhaseNotes(e.target.value)}
              placeholder="Document the key activities, observations, and outcomes of this phase..."
              rows={4}
              maxLength={5000}
            />
            <p className="text-[11px] text-muted-foreground text-right">{phaseNotes.length}/5000</p>
          </div>

          {/* Phase-Specific Fields */}
          {phaseFields.length > 0 && (
            <div className="space-y-3">
              <Label className="font-display text-sm font-semibold">Phase-Specific Information</Label>
              {phaseFields.map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <Label htmlFor={field.id} className="text-sm">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {field.type === "text" && (
                    <Input
                      id={field.id}
                      value={phaseData[field.id] || ""}
                      onChange={(e) => setPhaseData((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    />
                  )}
                  {field.type === "textarea" && (
                    <Textarea
                      id={field.id}
                      value={phaseData[field.id] || ""}
                      onChange={(e) => setPhaseData((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      rows={3}
                    />
                  )}
                  {field.type === "select" && field.options && (
                    <Select
                      value={phaseData[field.id] || ""}
                      onValueChange={(v) => setPhaseData((prev) => ({ ...prev, [field.id]: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {field.options.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Blockers Resolved */}
          <div className="space-y-2">
            <Label>Blockers Resolved</Label>
            <div className="flex gap-2">
              <Input
                value={blockerInput}
                onChange={(e) => setBlockerInput(e.target.value)}
                placeholder="Add a resolved blocker..."
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBlocker())}
              />
              <Button type="button" variant="outline" size="sm" onClick={addBlocker}>Add</Button>
            </div>
            {blockersResolved.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {blockersResolved.map((b, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="cursor-pointer text-xs"
                    onClick={() => setBlockersResolved(blockersResolved.filter((_, j) => j !== i))}
                  >
                    {b} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Key Decisions */}
          <div className="space-y-2">
            <Label>Key Decisions</Label>
            <div className="flex gap-2">
              <Input
                value={decisionInput}
                onChange={(e) => setDecisionInput(e.target.value)}
                placeholder="Add a key decision..."
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDecision())}
              />
              <Button type="button" variant="outline" size="sm" onClick={addDecision}>Add</Button>
            </div>
            {keyDecisions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {keyDecisions.map((d, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="cursor-pointer text-xs"
                    onClick={() => setKeyDecisions(keyDecisions.filter((_, j) => j !== i))}
                  >
                    {d} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
            {loading ? "Submitting..." : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm Transition
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PhaseFeedbackModal;
