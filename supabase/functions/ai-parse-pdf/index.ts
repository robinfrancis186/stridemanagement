import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text) throw new Error("text content is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert at extracting structured requirement data from documents for STRIDE COE assistive technology pipeline.

Extract all identifiable requirements from the text. For each requirement, extract:
- title: concise device/requirement name
- description: detailed description
- source_type: one of CDC, SEN, BLIND, ELDERLY, BUDS, OTHER
- priority: P1 (urgent), P2 (standard), P3 (low)
- tech_level: LOW, MEDIUM, HIGH
- therapy_domains: array from [OT, PT, Speech, ADL, Sensory, Cognitive]
- disability_types: array from [Physical, Visual, Hearing, Cognitive, Multiple]
- gap_flags: array from [RED, BLUE] or empty
- market_price: number or null
- stride_target_price: number or null

Be thorough and extract every requirement you can identify.`;

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
          { role: "user", content: `Extract requirements from this document text:\n\n${text.slice(0, 15000)}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_requirements",
              description: "Extract structured requirements from document",
              parameters: {
                type: "object",
                properties: {
                  requirements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        source_type: { type: "string", enum: ["CDC", "SEN", "BLIND", "ELDERLY", "BUDS", "OTHER"] },
                        priority: { type: "string", enum: ["P1", "P2", "P3"] },
                        tech_level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
                        therapy_domains: { type: "array", items: { type: "string" } },
                        disability_types: { type: "array", items: { type: "string" } },
                        gap_flags: { type: "array", items: { type: "string" } },
                        market_price: { type: "number" },
                        stride_target_price: { type: "number" },
                      },
                      required: ["title", "description", "source_type", "priority", "tech_level"],
                      additionalProperties: false,
                    },
                  },
                  summary: { type: "string", description: "Brief summary of what was extracted" },
                },
                required: ["requirements", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_requirements" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI extraction failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No extraction returned");

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, ...extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-parse-pdf error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
