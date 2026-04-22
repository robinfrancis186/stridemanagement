import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateJson, getErrorStatus } from "./_ai.js";
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

    const prompt = `You are an AI parsing Judging/Scores data for a Designathon from a raw CSV file.
Extract team names and their final numerical scores. Expected output format:
{
  "scores": [
    { "team_name": "Team A", "score": 85 }
  ]
}

Raw CSV Data:
${String(csvData).slice(0, 15000)}`;

    const parsed = await generateJson<{ scores?: Array<{ team_name?: string; score?: number }> }>([{ text: prompt }], {
      temperature: 0.1,
    });

    return res.status(200).json({ scores: parsed.scores || [] });
  } catch (error: any) {
    console.error("aiDesignathonJudging error:", error);
    const message = error?.message || "Unknown error";
    const status = message === "Authentication is required." ? 401 : getErrorStatus(error);
    return res.status(status).json({ error: message });
  }
}
