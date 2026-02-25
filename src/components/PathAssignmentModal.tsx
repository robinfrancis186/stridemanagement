import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Wrench, Users } from "lucide-react";

interface PathAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (path: "INTERNAL" | "DESIGNATHON", justification: string) => Promise<void>;
  loading?: boolean;
}

const PathAssignmentModal = ({ open, onOpenChange, onSubmit, loading }: PathAssignmentModalProps) => {
  const [path, setPath] = useState<"INTERNAL" | "DESIGNATHON" | "">("");
  const [justification, setJustification] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Assign Development Path</DialogTitle>
          <DialogDescription>
            This requirement is prioritized (S4). Choose a development path to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <RadioGroup value={path} onValueChange={(v) => setPath(v as "INTERNAL" | "DESIGNATHON")}>
            <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="INTERNAL" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Wrench className="h-4 w-4 text-primary" />
                  STRIDE Internal
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Design and prototype internally with STRIDE team designers. Best for simpler devices or when internal expertise is available.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="DESIGNATHON" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Users className="h-4 w-4 text-accent-foreground" />
                  Designathon / Hackathon
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Publish as a challenge for external teams. Best for complex devices requiring diverse perspectives.
                </p>
              </div>
            </label>
          </RadioGroup>

          <div className="space-y-2">
            <Label>Justification <span className="text-destructive">*</span></Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why this path was chosen..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => path && onSubmit(path, justification)}
            disabled={!path || !justification.trim() || loading}
          >
            {loading ? "Assigning..." : "Assign Path & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PathAssignmentModal;
