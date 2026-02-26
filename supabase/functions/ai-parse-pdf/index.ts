import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { text, base64, storagePath, fileName, fileType } = body;

    if (!text && !base64 && !storagePath) throw new Error("Either text, base64, or storagePath is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // If storagePath provided, download file from storage
    let fileBase64 = base64;
    if (storagePath && !fileBase64) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("requirement-files")
        .download(storagePath);

      if (downloadError || !fileData) throw new Error(`Failed to download file: ${downloadError?.message}`);

      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      // Convert to base64
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        for (let j = 0; j < chunk.length; j++) {
          binary += String.fromCharCode(chunk[j]);
        }
      }
      fileBase64 = btoa(binary);

      // Clean up temp file after download
      supabase.storage.from("requirement-files").remove([storagePath]).catch(() => {});
    }

    const systemPrompt = `You are an expert at extracting structured requirement data from documents for STRIDE COE assistive technology pipeline.

Extract all identifiable requirements from the document. For each requirement, extract:
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

    let userContent: any;

    if (fileBase64 && (fileType === "pdf" || fileType === "docx")) {
      const mimeType = fileType === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      userContent = [
        { type: "text", text: `Extract all requirements from this uploaded ${fileType.toUpperCase()} document.` },
        {
          type: "file",
          file: {
            filename: fileName || `document.${fileType}`,
            file_data: `data:${mimeType};base64,${fileBase64}`,
          },
        },
      ];
    } else {
      userContent = `Extract requirements from this document text:\n\n${(text || "").slice(0, 15000)}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
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
      const errText = await response.text().catch(() => "");
      throw new Error(`AI extraction failed (${status}): ${errText.slice(0, 200)}`);
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
