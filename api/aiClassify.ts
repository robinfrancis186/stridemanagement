import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateJson } from "./_ai.js";
import { getTable } from "./_supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", message: "Only POST requests are accepted" });
  }

  try {
    const { requirementId } = req.body ?? {};
    if (!requirementId) {
      return res.status(400).json({ error: "invalid-argument", message: "requirementId is required" });
    }

    const requirements = getTable(req, "requirements");
    const { data: requirement, error: requirementError } = await requirements
      .select("*")
      .eq("id", requirementId)
      .maybeSingle();

    if (requirementError) throw requirementError;
    if (!requirement) {
      return res.status(404).json({ error: "not-found", message: "Requirement not found" });
    }

    const prompt = `You are an expert assistive technology classifier for STRIDE COE. Analyze the requirement and classify it.

Available classifications:
- tech_level: LOW, MEDIUM, HIGH
- priority: P1 (urgent/critical), P2 (standard), P3 (low priority)
- therapy_domains: OT, PT, Speech, ADL, Sensory, Cognitive (can be multiple)
- disability_types: Physical, Visual, Hearing, Cognitive, Multiple (can be multiple)
- gap_flags: RED (critical unmet need, no solution exists), BLUE (improvement opportunity, solutions exist but inadequate) (can be multiple or empty)
- source_type: CDC, SEN, BLIND, ELDERLY, BUDS, OTHER

Classify this requirement:
Title: ${requirement.title}
Description: ${requirement.description || "No description"}
Current source: ${requirement.source_type}
Current tech level: ${requirement.tech_level}
Current priority: ${requirement.priority}

Return JSON with: { "tech_level", "priority", "therapy_domains", "disability_types", "gap_flags", "reasoning" }`;

    const classification = await generateJson<{
      tech_level?: string;
      priority?: string;
      therapy_domains?: string[];
      disability_types?: string[];
      gap_flags?: string[];
      reasoning?: string;
    }>([{ text: prompt }], { temperature: 0.2 });

    const { error: updateError } = await requirements
      .update({
        tech_level: classification.tech_level || requirement.tech_level,
        priority: classification.priority || requirement.priority,
        therapy_domains: classification.therapy_domains || [],
        disability_types: classification.disability_types || [],
        gap_flags: classification.gap_flags || [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", requirementId);

    if (updateError) throw updateError;

    return res.status(200).json({ success: true, classification });
  } catch (error: any) {
    console.error("aiClassify error:", error);
    const message = error?.message || "An unexpected error occurred";
    const status = message === "Authentication is required." ? 401 : 500;
    return res.status(status).json({ error: "internal", message });
  }
}
