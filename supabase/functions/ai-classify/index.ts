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

    const { data: requirement, error: reqError } = await supabase
      .from("requirements")
      .select("*")
      .eq("id", requirementId)
      .single();

    if (reqError || !requirement) throw new Error("Requirement not found");

    const systemPrompt = `You are an expert assistive technology classifier for STRIDE COE. Analyze the requirement and classify it.

Available classifications:
- tech_level: LOW, MEDIUM, HIGH
- priority: P1 (urgent/critical), P2 (standard), P3 (low priority)
- therapy_domains: OT, PT, Speech, ADL, Sensory, Cognitive (can be multiple)
- disability_types: Physical, Visual, Hearing, Cognitive, Multiple (can be multiple)
- gap_flags: RED (critical unmet need, no solution exists), BLUE (improvement opportunity, solutions exist but inadequate) (can be multiple or empty)
- source_type: CDC, SEN, BLIND, ELDERLY, BUDS, OTHER

Analyze the title, description, and existing data to provide the best classification.`;

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
          { role: "user", content: `Classify this requirement:\nTitle: ${requirement.title}\nDescription: ${requirement.description || "No description"}\nCurrent source: ${requirement.source_type}\nCurrent tech level: ${requirement.tech_level}\nCurrent priority: ${requirement.priority}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_requirement",
              description: "Classify the assistive technology requirement",
              parameters: {
                type: "object",
                properties: {
                  tech_level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
                  priority: { type: "string", enum: ["P1", "P2", "P3"] },
                  therapy_domains: { type: "array", items: { type: "string", enum: ["OT", "PT", "Speech", "ADL", "Sensory", "Cognitive"] } },
                  disability_types: { type: "array", items: { type: "string", enum: ["Physical", "Visual", "Hearing", "Cognitive", "Multiple"] } },
                  gap_flags: { type: "array", items: { type: "string", enum: ["RED", "BLUE"] } },
                  reasoning: { type: "string", description: "Brief explanation of the classification choices" },
                },
                required: ["tech_level", "priority", "therapy_domains", "disability_types", "gap_flags", "reasoning"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_requirement" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI error:", status, t);
      throw new Error("AI classification failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No classification returned from AI");

    const classification = JSON.parse(toolCall.function.arguments);

    // Update requirement with AI classification
    const { error: updateError } = await supabase
      .from("requirements")
      .update({
        tech_level: classification.tech_level,
        priority: classification.priority,
        therapy_domains: classification.therapy_domains,
        disability_types: classification.disability_types,
        gap_flags: classification.gap_flags,
      })
      .eq("id", requirementId);

    if (updateError) throw new Error(`Update failed: ${updateError.message}`);

    return new Response(JSON.stringify({ success: true, classification }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-classify error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
