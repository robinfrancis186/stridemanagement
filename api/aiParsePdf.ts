import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateJson } from "./_ai.js";
import { getSupabaseForRequest, requireRequestAuth } from "./_supabase.js";

const splitStoragePath = (fullPath: string) => {
  const [bucket, ...parts] = fullPath.split("/");
  return { bucket, path: parts.join("/") };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    requireRequestAuth(req);
    const { text, base64, storagePath, fileType } = req.body ?? {};

    if (!text && !base64 && !storagePath) {
      return res.status(400).json({ error: "invalid-argument", message: "Either text, base64, or storagePath is required" });
    }

    let fileBase64 = base64 as string | undefined;
    if (storagePath && !fileBase64) {
      const supabase = getSupabaseForRequest(req);
      const { bucket, path } = splitStoragePath(storagePath);
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error) throw error;

      const buffer = Buffer.from(await data.arrayBuffer());
      fileBase64 = buffer.toString("base64");

      await supabase.storage.from(bucket).remove([path]).catch(() => undefined);
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

Be thorough and extract every requirement you can identify.
Return your response as valid JSON with this structure:
{
  "requirements": [...],
  "summary": "Brief summary of what was extracted"
}`;

    const parts =
      fileBase64 && (fileType === "pdf" || fileType === "docx")
        ? [
            { text: `${systemPrompt}\n\nExtract all requirements from this uploaded ${String(fileType).toUpperCase()} document.` },
            {
              inlineData: {
                mimeType:
                  fileType === "pdf"
                    ? "application/pdf"
                    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                data: fileBase64,
              },
            },
          ]
        : [{ text: `${systemPrompt}\n\nExtract requirements from this document text:\n\n${String(text || "").slice(0, 30000)}` }];

    const extracted = await generateJson<Record<string, any>>(parts, { temperature: 0.2 });
    return res.status(200).json({ success: true, ...extracted });
  } catch (error: any) {
    console.error("aiParsePdf error:", error);
    const message = error?.message || "An unexpected error occurred";
    const status = message === "Authentication is required." ? 401 : 500;
    return res.status(status).json({ error: "internal", message });
  }
}
