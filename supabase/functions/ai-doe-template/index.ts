import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { requirementId } = await req.json();
    if (!requirementId) throw new Error("requirementId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: requirement } = await supabase
      .from("requirements")
      .select("*")
      .eq("id", requirementId)
      .single();

    if (!requirement) throw new Error("Requirement not found");

    const systemPrompt = `You are an expert in Design of Experiments (DoE) for assistive technology devices at STRIDE COE.

Generate a comprehensive DoE template based on the requirement details. The template should include:
- testing_protocol: Detailed step-by-step testing protocol
- sample_size: Recommended sample size with justification
- baseline_data: Structure for baseline measurements (key metrics to capture)
- beneficiary_profiles: Template for participant profiles
- pre_test_data: What to measure before intervention
- post_test_data: What to measure after intervention
- improvement_metrics: Key improvement metrics to track
- statistical_analysis: Recommended statistical methods

Consider the device type, disability types, therapy domains, and tech level when generating.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a DoE template for:\nTitle: ${requirement.title}\nDescription: ${requirement.description || "N/A"}\nTech Level: ${requirement.tech_level}\nDisability Types: ${(requirement.disability_types || []).join(", ") || "N/A"}\nTherapy Domains: ${(requirement.therapy_domains || []).join(", ") || "N/A"}\nPriority: ${requirement.priority}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_doe_template",
              description: "Generate a Design of Experiments template",
              parameters: {
                type: "object",
                properties: {
                  testing_protocol: { type: "string" },
                  sample_size: { type: "number" },
                  sample_size_justification: { type: "string" },
                  baseline_metrics: { type: "array", items: { type: "object", properties: { metric_name: { type: "string" }, measurement_method: { type: "string" }, unit: { type: "string" } }, required: ["metric_name", "measurement_method", "unit"], additionalProperties: false } },
                  beneficiary_criteria: { type: "array", items: { type: "string" } },
                  pre_test_measures: { type: "array", items: { type: "string" } },
                  post_test_measures: { type: "array", items: { type: "string" } },
                  improvement_metrics: { type: "array", items: { type: "object", properties: { metric: { type: "string" }, target_improvement: { type: "string" } }, required: ["metric", "target_improvement"], additionalProperties: false } },
                  statistical_methods: { type: "array", items: { type: "string" } },
                  estimated_duration_weeks: { type: "number" },
                },
                required: ["testing_protocol", "sample_size", "baseline_metrics", "beneficiary_criteria", "pre_test_measures", "post_test_measures", "improvement_metrics", "statistical_methods", "estimated_duration_weeks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_doe_template" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI generation failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No template returned");

    const template = JSON.parse(toolCall.function.arguments);

    // Save DoE record
    const { error: insertError } = await supabase.from("doe_records").insert({
      requirement_id: requirementId,
      testing_protocol: template.testing_protocol,
      sample_size: template.sample_size,
      baseline_data: { metrics: template.baseline_metrics },
      beneficiary_profiles: template.beneficiary_criteria,
      pre_test_data: { measures: template.pre_test_measures },
      post_test_data: { measures: template.post_test_measures },
      improvement_metrics: template.improvement_metrics,
      statistical_analysis: { methods: template.statistical_methods, estimated_duration_weeks: template.estimated_duration_weeks },
    });

    if (insertError) throw new Error(`Failed to save DoE: ${insertError.message}`);

    return new Response(JSON.stringify({ success: true, template }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-doe-template error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
