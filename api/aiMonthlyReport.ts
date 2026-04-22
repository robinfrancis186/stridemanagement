import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateText } from "./_ai.js";
import { getTable } from "./_supabase.js";

const getMonthRange = (month: string) => {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error("month must be in YYYY-MM format");
  }

  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { month } = req.body ?? {};
    if (!month) {
      return res.status(400).json({ error: "month is required (YYYY-MM)" });
    }

    const { startIso, endIso } = getMonthRange(month);

    const [requirementsResult, transitionsResult] = await Promise.all([
      getTable(req, "requirements").select("*"),
      getTable(req, "state_transitions")
        .select("*")
        .gte("created_at", startIso)
        .lt("created_at", endIso),
    ]);

    if (requirementsResult.error) throw requirementsResult.error;
    if (transitionsResult.error) throw transitionsResult.error;

    const requirements = requirementsResult.data ?? [];
    const transitions = transitionsResult.data ?? [];

    const monthRequirements = requirements.filter((requirement) => requirement.created_at && String(requirement.created_at).slice(0, 7) <= month);
    const newThisMonth = requirements.filter((requirement) => requirement.created_at && String(requirement.created_at).slice(0, 7) === month);
    const productionReady = monthRequirements.filter((requirement) => requirement.current_state === "H-DOE-5");

    const aging = monthRequirements.filter((requirement) => {
      const updatedAt = requirement.updated_at ? new Date(requirement.updated_at).getTime() : Date.now();
      const days = (Date.now() - updatedAt) / 86400000;
      const state = requirement.current_state;
      if (!state) return false;
      if (state.startsWith("S") && days > 14) return true;
      if (state.startsWith("H-INT") && days > 60) return true;
      if (state.startsWith("H-DES") && days > 90) return true;
      if (state.startsWith("H-DOE") && days > 45) return true;
      return false;
    });

    const dataForAI = {
      month,
      total_pipeline: monthRequirements.length,
      new_this_month: newThisMonth.length,
      production_ready: productionReady.length,
      transitions_this_month: transitions.length,
      aging_alerts: aging.length,
      aging_items: aging.map((requirement) => ({
        title: requirement.title,
        state: requirement.current_state,
        days_stuck: Math.round((Date.now() - new Date(requirement.updated_at).getTime()) / 86400000),
      })),
      state_distribution: Object.entries(
        monthRequirements.reduce<Record<string, number>>((accumulator, requirement) => {
          accumulator[requirement.current_state] = (accumulator[requirement.current_state] || 0) + 1;
          return accumulator;
        }, {}),
      ).map(([state, count]) => ({ state, count })),
      priority_distribution: Object.entries(
        monthRequirements.reduce<Record<string, number>>((accumulator, requirement) => {
          accumulator[requirement.priority] = (accumulator[requirement.priority] || 0) + 1;
          return accumulator;
        }, {}),
      ).map(([priority, count]) => ({ priority, count })),
    };

    const prompt = `You are a senior leadership report writer for STRIDE COE. Generate a comprehensive monthly report for leadership review.

The report should include:
1. Executive Summary
2. Key Metrics & Highlights
3. Pipeline Health Analysis
4. Aging & Bottleneck Analysis
5. Recommendations & Action Items
6. Risk Assessment

Write in professional, concise language suitable for C-level executives. Use markdown formatting.

Generate the monthly leadership report for ${month} based on this data:

${JSON.stringify(dataForAI, null, 2)}`;

    const report = await generateText([{ text: prompt }], { temperature: 0.3 });
    if (!report) {
      return res.status(500).json({ error: "No report generated from AI" });
    }

    return res.status(200).json({ success: true, report, data: dataForAI });
  } catch (error: any) {
    console.error("aiMonthlyReport error:", error);
    const message = error?.message || "Unknown error";
    const status = message === "Authentication is required." ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
