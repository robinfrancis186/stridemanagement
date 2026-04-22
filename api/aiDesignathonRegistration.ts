import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateJson } from "./_ai.js";
import { requireRequestAuth } from "./_supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    requireRequestAuth(req);
    const { csvData } = req.body ?? {};
    if (!csvData) {
      return res.status(400).json({ error: "csvData is required" });
    }

    const prompt = `You are an AI assistant helping to parse Designathon Team Registration data from a raw, noisy CSV file.
Extract all the teams mentioned. Expected output should be valid JSON in this exact structure:
{
  "teams": [
    { "team_name": "Team A", "members": ["Alice", "Bob"] }
  ]
}
Do not include any other markdown or text outside the JSON. Extract as many teams as you can find.

Raw CSV Data:
${String(csvData).slice(0, 15000)}`;

    const parsed = await generateJson<{ teams?: Array<{ team_name?: string; members?: string[] }> }>([{ text: prompt }], {
      temperature: 0.1,
    });

    return res.status(200).json({ teams: parsed.teams || [] });
  } catch (error: any) {
    console.error("aiDesignathonRegistration error:", error);
    const message = error?.message || "Unknown error";
    const status = message === "Authentication is required." ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
