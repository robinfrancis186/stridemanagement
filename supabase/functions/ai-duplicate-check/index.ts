import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, description } = await req.json();
    if (!title) throw new Error("title is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch existing requirements
    const { data: existing, error: fetchErr } = await supabase
      .from("requirements")
      .select("id, title, description, current_state, therapy_domains, disability_types")
      .limit(200);

    if (fetchErr) throw new Error(`Fetch error: ${fetchErr.message}`);
    if (!existing || existing.length === 0) {
      return new Response(JSON.stringify({ duplicates: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingList = existing.map((r: any) =>
      `[${r.id}] "${r.title}" — ${r.description || "No description"} (State: ${r.current_state})`
    ).join("\n");

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
            content: `You are a duplicate detection expert for assistive technology requirements. Compare the NEW requirement against the EXISTING list and find potential duplicates or very similar items. Consider semantic similarity, not just exact text matches. A requirement is a duplicate if it describes the same device/need even with different wording.`,
          },
          {
            role: "user",
            content: `NEW REQUIREMENT:\nTitle: ${title}\nDescription: ${description || "None"}\n\nEXISTING REQUIREMENTS:\n${existingList}\n\nFind duplicates or very similar requirements.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_duplicates",
              description: "Report potential duplicate requirements",
              parameters: {
                type: "object",
                properties: {
                  duplicates: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "UUID of the existing requirement" },
                        title: { type: "string" },
                        similarity: { type: "string", enum: ["exact", "high", "moderate"] },
                        reason: { type: "string", description: "Why this is considered a duplicate" },
                      },
                      required: ["id", "title", "similarity", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["duplicates"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_duplicates" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI error:", status, t);
      throw new Error("Duplicate check failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ duplicates: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-duplicate-check error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
