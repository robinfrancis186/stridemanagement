import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATES, type StateKey } from "@/lib/constants";
import { format } from "date-fns";
import { ArrowLeft, FileText, Package, Clock, FlaskConical, Gavel, History } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

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

const DeviceDocumentation = () => {
  const { id } = useParams<{ id: string }>();
  const [req, setReq] = useState<Requirement | null>(null);
  const [transitions, setTransitions] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [doeRecord, setDoeRecord] = useState<any>(null);
  const [decision, setDecision] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const [rq, tr, fb, doe, dec] = await Promise.all([
          supabase.from("requirements").select("*").eq("id", id).single(),
          supabase.from("state_transitions").select("*").eq("requirement_id", id).order("created_at"),
          supabase.from("phase_feedbacks").select("*").eq("requirement_id", id).order("created_at"),
          supabase.from("doe_records").select("*").eq("requirement_id", id).limit(1).maybeSingle(),
          supabase.from("committee_decisions").select("*").eq("requirement_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);

        setReq(rq.data as Requirement | null);
        setTransitions(tr.data || []);
        setFeedbacks(fb.data || []);
        setDoeRecord(doe.data);
        setDecision(dec.data);
      } catch (error) {
        console.error("Failed to load device documentation data:", error);
        setReq(null);
        setTransitions([]);
        setFeedbacks([]);
        setDoeRecord(null);
        setDecision(null);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [id]);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  if (!req) return <div className="py-12 text-center text-muted-foreground">Not found.</div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to={`/requirements/${req.id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Device Documentation Package</h1>
          <p className="text-sm text-muted-foreground">{req.title}</p>
        </div>
      </div>

      {/* Cover / Executive Summary */}
      <Card className="shadow-card border-primary/20">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div><span className="text-muted-foreground">Device Title:</span> <span className="font-medium">{req.title}</span></div>
            <div><span className="text-muted-foreground">Source:</span> <Badge variant="secondary">{req.source_type}</Badge></div>
            <div><span className="text-muted-foreground">Priority:</span> <Badge className={req.priority === "P1" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}>{req.priority}</Badge></div>
            <div><span className="text-muted-foreground">Tech Level:</span> <Badge variant="secondary">{req.tech_level}</Badge></div>
            <div><span className="text-muted-foreground">Path:</span> {req.path_assignment || "—"}</div>
            <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{req.current_state}</Badge></div>
          </div>
          {req.description && <div><span className="text-muted-foreground">Description:</span><p className="mt-1">{req.description}</p></div>}
        </CardContent>
      </Card>

      {/* Target User Profile */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="font-display text-base">Target User Profile</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Disability Types:</span> {req.disability_types?.length ? req.disability_types.map(d => <Badge key={d} variant="secondary" className="ml-1 text-[10px]">{d}</Badge>) : "—"}</div>
          <div><span className="text-muted-foreground">Therapy Domains:</span> {req.therapy_domains?.length ? req.therapy_domains.map(d => <Badge key={d} variant="secondary" className="ml-1 text-[10px]">{d}</Badge>) : "—"}</div>
        </CardContent>
      </Card>

      {/* Market Comparison */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="font-display text-base">Market Comparison</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-2xl font-bold font-display">{req.market_price ? `$${req.market_price}` : "—"}</p><p className="text-xs text-muted-foreground">Market Price</p></div>
            <div><p className="text-2xl font-bold font-display text-secondary">{req.stride_target_price ? `$${req.stride_target_price}` : "—"}</p><p className="text-xs text-muted-foreground">STRIDE Price</p></div>
            <div><p className="text-2xl font-bold font-display text-success">{req.market_price && req.stride_target_price ? `$${req.market_price - req.stride_target_price}` : "—"}</p><p className="text-xs text-muted-foreground">Savings</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Design Journey Timeline */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Design Journey Timeline ({transitions.length} transitions)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transitions.length === 0 ? <p className="text-sm text-muted-foreground">No transitions.</p> : (
            <div className="space-y-2">
              {transitions.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 text-sm border-b pb-2">
                  <Badge variant="outline" className="text-[10px]">{t.from_state}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline" className="text-[10px]">{t.to_state}</Badge>
                  <span className="flex-1" />
                  <span className="text-[11px] text-muted-foreground">{format(new Date(t.created_at), "PPp")}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase Feedback Record */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Phase Feedback Record ({feedbacks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {feedbacks.map((fb: any) => (
            <div key={fb.id} className="border rounded-lg p-3 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{fb.from_state} → {fb.to_state}</span>
                <span className="text-[11px] text-muted-foreground">{format(new Date(fb.created_at), "PPp")}</span>
              </div>
              {fb.phase_notes && <p className="text-muted-foreground">{fb.phase_notes}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* DoE Report */}
      {doeRecord && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              DoE Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {doeRecord.testing_protocol && <div><span className="text-muted-foreground">Protocol:</span> {doeRecord.testing_protocol}</div>}
            {doeRecord.sample_size && <div><span className="text-muted-foreground">Sample Size:</span> {doeRecord.sample_size}</div>}
            {doeRecord.results_summary && <div><span className="text-muted-foreground">Results:</span> {doeRecord.results_summary}</div>}
            {doeRecord.beneficiary_feedback && <div><span className="text-muted-foreground">Beneficiary Feedback:</span> {doeRecord.beneficiary_feedback}</div>}
          </CardContent>
        </Card>
      )}

      {/* Committee Decision */}
      {decision && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Gavel className="h-4 w-4 text-primary" />
              Committee Review Record
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Badge className={decision.decision === "APPROVE" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>{decision.decision}</Badge>
            {decision.conditions && <div><span className="text-muted-foreground">Conditions:</span> {decision.conditions}</div>}
            <div className="text-xs text-muted-foreground">{format(new Date(decision.created_at), "PPp")}</div>
          </CardContent>
        </Card>
      )}

      {/* Revision History */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Version Info
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div><span className="text-muted-foreground">Revision Number:</span> #{req.revision_number}</div>
          <div><span className="text-muted-foreground">Created:</span> {format(new Date(req.created_at), "PPp")}</div>
          <div><span className="text-muted-foreground">Last Updated:</span> {format(new Date(req.updated_at), "PPp")}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeviceDocumentation;
