import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { requirementId } = await req.json();
    if (!requirementId) throw new Error("requirementId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all related data in parallel
    const [reqRes, transRes, fbRes, doeRes, decRes, reviewsRes, filesRes] = await Promise.all([
      supabase.from("requirements").select("*").eq("id", requirementId).single(),
      supabase.from("state_transitions").select("*").eq("requirement_id", requirementId).order("created_at"),
      supabase.from("phase_feedbacks").select("*").eq("requirement_id", requirementId).order("created_at"),
      supabase.from("doe_records").select("*").eq("requirement_id", requirementId).limit(1).maybeSingle(),
      supabase.from("committee_decisions").select("*").eq("requirement_id", requirementId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("committee_reviews").select("*").eq("requirement_id", requirementId),
      supabase.from("requirement_files").select("*").eq("requirement_id", requirementId),
    ]);

    if (reqRes.error || !reqRes.data) throw new Error("Requirement not found");

    const r = reqRes.data;
    const transitions = transRes.data || [];
    const feedbacks = fbRes.data || [];
    const doe = doeRes.data;
    const decision = decRes.data;
    const reviews = reviewsRes.data || [];
    const files = filesRes.data || [];

    const prompt = `You are a technical documentation specialist for assistive technology devices at STRIDE COE (Center of Excellence). Generate a comprehensive Device Documentation Package in markdown format for the following requirement. This should be a professional, publication-ready document.

## Requirement Data
- Title: ${r.title}
- Description: ${r.description || "N/A"}
- Source: ${r.source_type}
- Priority: ${r.priority}
- Tech Level: ${r.tech_level}
- Disability Types: ${(r.disability_types || []).join(", ") || "N/A"}
- Therapy Domains: ${(r.therapy_domains || []).join(", ") || "N/A"}
- Gap Flags: ${(r.gap_flags || []).join(", ") || "None"}
- Market Price: ${r.market_price ? `$${r.market_price}` : "N/A"}
- STRIDE Target Price: ${r.stride_target_price ? `$${r.stride_target_price}` : "N/A"}
- Path: ${r.path_assignment || "N/A"}
- Current State: ${r.current_state}
- Revision: #${r.revision_number}

## State Transitions (${transitions.length} total)
${transitions.map((t: any) => `- ${t.from_state} → ${t.to_state} (${t.created_at}): ${t.notes || "No notes"}`).join("\n")}

## Phase Feedbacks (${feedbacks.length} total)
${feedbacks.map((f: any) => `- ${f.from_state} → ${f.to_state}: ${f.phase_notes || "No notes"}. Blockers: ${(f.blockers_resolved || []).join(", ") || "None"}. Decisions: ${(f.key_decisions || []).join(", ") || "None"}`).join("\n")}

## DoE Record
${doe ? `Protocol: ${doe.testing_protocol || "N/A"}, Sample Size: ${doe.sample_size || "N/A"}, Results: ${doe.results_summary || "N/A"}, Feedback: ${doe.beneficiary_feedback || "N/A"}` : "No DoE record available."}

## Committee Reviews (${reviews.length})
${reviews.map((rv: any) => `- Reviewer: Safety=${rv.safety_score}, Tech=${rv.technical_feasibility_score}, Cost=${rv.cost_effectiveness_score}, Need=${rv.user_need_score}, DoE=${rv.doe_results_score}, Total=${rv.weighted_total}. Rec: ${rv.recommendation}. ${rv.feedback_text || ""}`).join("\n") || "None"}

## Committee Decision
${decision ? `Decision: ${decision.decision}. Conditions: ${decision.conditions || "None"}` : "No committee decision yet."}

## Attached Files (${files.length})
${files.map((f: any) => `- ${f.file_name} (${f.file_type}, ${f.file_size} bytes)`).join("\n") || "None"}

Generate a comprehensive document with these sections:
1. **Cover Page** - Title, date, version, STRIDE COE branding
2. **Executive Summary** - 2-3 paragraph overview
3. **Device Specification** - Detailed technical specs, classification, target users
4. **Market Analysis** - Price comparison, cost savings, competitive landscape
5. **Design Journey** - Timeline of all phases with key decisions
6. **Design of Experiments (DoE) Report** - Testing methodology, results, statistical analysis
7. **Committee Review Summary** - Scores, feedback, final decision
8. **Risk Assessment** - Based on gap flags and technical complexity
9. **Production Readiness Checklist** - Based on current state and completeness
10. **Appendices** - File listing, version history

Use professional language. Include tables where appropriate using markdown tables.`;

    const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!aiRes.ok) throw new Error(`AI API error: ${aiRes.status}`);
    const aiData = await aiRes.json();
    const document = aiData.choices?.[0]?.message?.content || "Failed to generate document.";

    return new Response(JSON.stringify({ document, requirement: r }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
