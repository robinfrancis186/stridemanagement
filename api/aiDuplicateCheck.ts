import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateJson } from "./_ai.js";
import { getTable } from "./_supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { title, description } = req.body ?? {};
    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    const { data: existingRequirements, error } = await getTable(req, "requirements")
      .select("id,title,description,current_state")
      .limit(200);

    if (error) throw error;
    if (!existingRequirements?.length) {
      return res.status(200).json({ duplicates: [] });
    }

    const existingList = existingRequirements
      .map((requirement) => `[${requirement.id}] "${requirement.title}" — ${requirement.description || "No description"} (State: ${requirement.current_state})`)
      .join("\n");

    const prompt = `You are a duplicate detection expert for assistive technology requirements. Compare the NEW requirement against the EXISTING list and find potential duplicates or very similar items. Consider semantic similarity, not just exact text matches.

NEW REQUIREMENT:
Title: ${title}
Description: ${description || "None"}

EXISTING REQUIREMENTS:
${existingList}

Return JSON with: { "duplicates": [{ "id": "UUID", "title": "...", "similarity": "exact|high|moderate", "reason": "..." }] }
Return empty duplicates array if no duplicates found.`;

    const parsed = await generateJson<{ duplicates?: Array<Record<string, any>> }>([{ text: prompt }], {
      temperature: 0.2,
    });

    return res.status(200).json({ duplicates: parsed.duplicates || [] });
  } catch (error: any) {
    console.error("aiDuplicateCheck error:", error);
    const message = error?.message || "Unknown error";
    const status = message === "Authentication is required." ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
