import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { SOURCE_TYPES, PRIORITIES, TECH_LEVELS, THERAPY_DOMAINS, DISABILITY_TYPES } from "@/lib/constants";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "react-router-dom";
import AIPDFUploader from "@/components/AIPDFUploader";
import DuplicateDetector from "@/components/DuplicateDetector";

const NewRequirement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState<string>("");
  const [priority, setPriority] = useState("P2");
  const [techLevel, setTechLevel] = useState("LOW");
  const [marketPrice, setMarketPrice] = useState("");
  const [strideTargetPrice, setStrideTargetPrice] = useState("");
  const [selectedDisabilities, setSelectedDisabilities] = useState<string[]>([]);
  const [selectedTherapies, setSelectedTherapies] = useState<string[]>([]);
  const [gapFlags, setGapFlags] = useState<string[]>([]);

  const toggleItem = (arr: string[], setArr: (v: string[]) => void, item: string) => {
    setArr(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !sourceType) {
      toast({ title: "Missing fields", description: "Title and Source Type are required.", variant: "destructive" });
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.from("requirements").insert({
      title,
      description: description || null,
      source_type: sourceType,
      priority,
      tech_level: techLevel,
      market_price: marketPrice ? parseFloat(marketPrice) : null,
      stride_target_price: strideTargetPrice ? parseFloat(strideTargetPrice) : null,
      disability_types: selectedDisabilities,
      therapy_domains: selectedTherapies,
      gap_flags: gapFlags,
      current_state: "S1",
      created_by: null,
    }).select().single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Create initial state transition
    if (data) {
      await supabase.from("state_transitions").insert({
        requirement_id: data.id,
        from_state: "NEW",
        to_state: "S1",
        transitioned_by: null,
        notes: "Requirement captured",
      });
    }

    toast({ title: "Success", description: "Requirement created and set to S1 (Captured)." });
    navigate("/requirements");
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link to="/requirements">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">New Requirement</h1>
          <p className="text-sm text-muted-foreground">Add a new assistive device requirement to the pipeline</p>
        </div>
      </div>

      <AIPDFUploader />
      <DuplicateDetector title={title} description={description} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="font-display text-base">Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Device Title *</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Adaptive Grip Handle" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the device requirement..." rows={4} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Source Type *</Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tech Level</Label>
                <Select value={techLevel} onValueChange={setTechLevel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TECH_LEVELS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="font-display text-base">Classification</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">Disability Types</Label>
              <div className="flex flex-wrap gap-3">
                {DISABILITY_TYPES.map((d) => (
                  <label key={d} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selectedDisabilities.includes(d)} onCheckedChange={() => toggleItem(selectedDisabilities, setSelectedDisabilities, d)} />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Therapy Domains</Label>
              <div className="flex flex-wrap gap-3">
                {THERAPY_DOMAINS.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selectedTherapies.includes(t)} onCheckedChange={() => toggleItem(selectedTherapies, setSelectedTherapies, t)} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Gap Flags</Label>
              <div className="flex gap-4">
                {["RED", "BLUE"].map((g) => (
                  <label key={g} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={gapFlags.includes(g)} onCheckedChange={() => toggleItem(gapFlags, setGapFlags, g)} />
                    {g} Gap
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="font-display text-base">Pricing</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Market Price ($)</Label>
                <Input type="number" step="0.01" value={marketPrice} onChange={(e) => setMarketPrice(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>STRIDE Target Price ($)</Label>
                <Input type="number" step="0.01" value={strideTargetPrice} onChange={(e) => setStrideTargetPrice(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link to="/requirements"><Button variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Creating..." : "Create Requirement"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NewRequirement;
