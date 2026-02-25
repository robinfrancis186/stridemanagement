import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { FlaskConical, Save, TrendingUp } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface DoERecord {
  id: string;
  testing_protocol: string | null;
  sample_size: number | null;
  baseline_data: Record<string, number>;
  pre_test_data: Record<string, number>;
  post_test_data: Record<string, number>;
  results_summary: string | null;
  improvement_metrics: Record<string, number>;
  beneficiary_feedback: string | null;
}

interface DoETabProps {
  requirementId: string;
  currentState: string;
  isAdmin: boolean;
}

const METRIC_KEYS = ["Functionality", "Comfort", "Durability", "Ease of Use", "Safety"];

const DoETab = ({ requirementId, currentState, isAdmin }: DoETabProps) => {
  const { user } = useAuth();
  const [record, setRecord] = useState<DoERecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [protocol, setProtocol] = useState("");
  const [sampleSize, setSampleSize] = useState("");
  const [preTest, setPreTest] = useState<Record<string, string>>({});
  const [postTest, setPostTest] = useState<Record<string, string>>({});
  const [resultsSummary, setResultsSummary] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("doe_records")
        .select("*")
        .eq("requirement_id", requirementId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const rec = data as unknown as DoERecord;
        setRecord(rec);
        setProtocol(rec.testing_protocol || "");
        setSampleSize(rec.sample_size?.toString() || "");
        setPreTest(Object.fromEntries(METRIC_KEYS.map(k => [k, (rec.pre_test_data?.[k] ?? "").toString()])));
        setPostTest(Object.fromEntries(METRIC_KEYS.map(k => [k, (rec.post_test_data?.[k] ?? "").toString()])));
        setResultsSummary(rec.results_summary || "");
        setFeedback(rec.beneficiary_feedback || "");
      } else {
        setPreTest(Object.fromEntries(METRIC_KEYS.map(k => [k, ""])));
        setPostTest(Object.fromEntries(METRIC_KEYS.map(k => [k, ""])));
      }
      setLoading(false);
    };
    fetch();
  }, [requirementId]);

  const handleSave = async () => {
    setSaving(true);
    const preData = Object.fromEntries(METRIC_KEYS.map(k => [k, parseFloat(preTest[k]) || 0]));
    const postData = Object.fromEntries(METRIC_KEYS.map(k => [k, parseFloat(postTest[k]) || 0]));
    const improvements = Object.fromEntries(METRIC_KEYS.map(k => [k, (postData[k] - preData[k])]));

    const payload = {
      requirement_id: requirementId,
      testing_protocol: protocol,
      sample_size: parseInt(sampleSize) || null,
      pre_test_data: preData as unknown as Json,
      post_test_data: postData as unknown as Json,
      results_summary: resultsSummary,
      improvement_metrics: improvements as unknown as Json,
      beneficiary_feedback: feedback,
      created_by: user?.id,
    };

    let error;
    if (record) {
      ({ error } = await supabase.from("doe_records").update(payload).eq("id", record.id));
    } else {
      ({ error } = await supabase.from("doe_records").insert(payload));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "DoE data saved successfully." });
    }
    setSaving(false);
  };

  // Chart data
  const chartData = METRIC_KEYS.map(k => ({
    name: k,
    "Pre-Test": parseFloat(preTest[k]) || 0,
    "Post-Test": parseFloat(postTest[k]) || 0,
  }));

  const isDoePhase = currentState.startsWith("H-DOE");

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading DoE data...</div>;

  return (
    <div className="space-y-4">
      {!isDoePhase && (
        <Card className="shadow-card border-warning/30 bg-warning/5">
          <CardContent className="p-4 text-sm text-warning">
            DoE data capture is available once the requirement enters the DoE phase (H-DOE-1+).
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Protocol & Setup */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-sm flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              Testing Protocol
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Protocol Description</Label>
              <Textarea
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                placeholder="Describe the testing protocol..."
                disabled={!isAdmin}
                className="mt-1 text-sm"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-xs">Sample Size</Label>
              <Input
                type="number"
                value={sampleSize}
                onChange={(e) => setSampleSize(e.target.value)}
                placeholder="Number of participants"
                disabled={!isAdmin}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Beneficiary Feedback</Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Qualitative feedback from beneficiaries..."
                disabled={!isAdmin}
                className="mt-1 text-sm"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-secondary" />
              Results Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={resultsSummary}
              onChange={(e) => setResultsSummary(e.target.value)}
              placeholder="Summarize key findings and statistical results..."
              disabled={!isAdmin}
              className="text-sm"
              rows={10}
            />
          </CardContent>
        </Card>
      </div>

      {/* Pre/Post Test Data Entry */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-sm">Measurement Data (Score 0–10)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3 text-xs font-medium text-muted-foreground border-b pb-2">
              <span>Metric</span>
              <span>Pre-Test</span>
              <span>Post-Test</span>
            </div>
            {METRIC_KEYS.map(k => (
              <div key={k} className="grid grid-cols-3 gap-3 items-center">
                <span className="text-sm">{k}</span>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={preTest[k]}
                  onChange={(e) => setPreTest({ ...preTest, [k]: e.target.value })}
                  disabled={!isAdmin}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={postTest[k]}
                  onChange={(e) => setPostTest({ ...postTest, [k]: e.target.value })}
                  disabled={!isAdmin}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Chart */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-sm">Pre vs Post Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Pre-Test" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Post-Test" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save DoE Data"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default DoETab;
