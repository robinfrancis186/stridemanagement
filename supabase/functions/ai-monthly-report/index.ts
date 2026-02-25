import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { month } = await req.json(); // format: "YYYY-MM"
    if (!month) throw new Error("month is required (YYYY-MM)");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all requirements and transitions for the month
    const [reqRes, transRes] = await Promise.all([
      supabase.from("requirements").select("*"),
      supabase.from("state_transitions").select("*").gte("created_at", `${month}-01`).lt("created_at", `${month}-32`),
    ]);

    const requirements = reqRes.data || [];
    const transitions = transRes.data || [];

    const monthReqs = requirements.filter((r: any) => r.created_at.slice(0, 7) <= month);
    const newThisMonth = requirements.filter((r: any) => r.created_at.slice(0, 7) === month);
    const productionReady = monthReqs.filter((r: any) => r.current_state === "H-DOE-5");

    // Aging analysis
    const aging = monthReqs.filter((r: any) => {
      const days = (Date.now() - new Date(r.updated_at).getTime()) / 86400000;
      const s = r.current_state;
      if (s.startsWith("S") && days > 14) return true;
      if (s.startsWith("H-INT") && days > 60) return true;
      if (s.startsWith("H-DES") && days > 90) return true;
      if (s.startsWith("H-DOE") && days > 45) return true;
      return false;
    });

    const dataForAI = {
      month,
      total_pipeline: monthReqs.length,
      new_this_month: newThisMonth.length,
      production_ready: productionReady.length,
      transitions_this_month: transitions.length,
      aging_alerts: aging.length,
      aging_items: aging.map((r: any) => ({
        title: r.title,
        state: r.current_state,
        days_stuck: Math.round((Date.now() - new Date(r.updated_at).getTime()) / 86400000),
      })),
      state_distribution: Object.entries(
        monthReqs.reduce((acc: Record<string, number>, r: any) => {
          acc[r.current_state] = (acc[r.current_state] || 0) + 1;
          return acc;
        }, {})
      ).map(([state, count]) => ({ state, count })),
      priority_distribution: Object.entries(
        monthReqs.reduce((acc: Record<string, number>, r: any) => {
          acc[r.priority] = (acc[r.priority] || 0) + 1;
          return acc;
        }, {})
      ).map(([priority, count]) => ({ priority, count })),
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a senior leadership report writer for STRIDE COE. Generate a comprehensive monthly report for leadership review.
            
The report should include:
1. Executive Summary
2. Key Metrics & Highlights
3. Pipeline Health Analysis
4. Aging & Bottleneck Analysis
5. Recommendations & Action Items
6. Risk Assessment

Write in professional, concise language suitable for C-level executives. Use markdown formatting.`,
          },
          { role: "user", content: `Generate the monthly leadership report for ${month} based on this data:\n\n${JSON.stringify(dataForAI, null, 2)}` },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI report generation failed");
    }

    const aiResult = await response.json();
    const reportContent = aiResult.choices?.[0]?.message?.content;
    if (!reportContent) throw new Error("No report generated");

    return new Response(JSON.stringify({ success: true, report: reportContent, data: dataForAI }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-monthly-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
