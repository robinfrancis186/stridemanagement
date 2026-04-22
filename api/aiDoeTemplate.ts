import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateJson, getErrorStatus } from "./_ai.js";
import { getTable } from "./_supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { requirementId } = req.body ?? {};
    if (!requirementId) {
      return res.status(400).json({ error: "requirementId is required" });
    }

    const requirements = getTable(req, "requirements");
    const { data: requirement, error: requirementError } = await requirements
      .select("*")
      .eq("id", requirementId)
      .maybeSingle();

    if (requirementError) throw requirementError;
    if (!requirement) {
      return res.status(404).json({ error: "Requirement not found" });
    }

    const prompt = `You are an expert in Design of Experiments (DoE) for assistive technology devices at STRIDE COE.

Generate a comprehensive DoE template for:
Title: ${requirement.title}
Description: ${requirement.description || "N/A"}
Tech Level: ${requirement.tech_level}
Disability Types: ${(requirement.disability_types || []).join(", ") || "N/A"}
Therapy Domains: ${(requirement.therapy_domains || []).join(", ") || "N/A"}
Priority: ${requirement.priority}

Return JSON with:
{
  "testing_protocol": "step-by-step protocol",
  "sample_size": number,
  "sample_size_justification": "reason",
  "baseline_metrics": [{ "metric_name": "", "measurement_method": "", "unit": "" }],
  "beneficiary_criteria": ["criteria1", ...],
  "pre_test_measures": ["measure1", ...],
  "post_test_measures": ["measure1", ...],
  "improvement_metrics": [{ "metric": "", "target_improvement": "" }],
  "statistical_methods": ["method1", ...],
  "estimated_duration_weeks": number
}`;

    const template = await generateJson<Record<string, any>>([{ text: prompt }], { temperature: 0.3 });

    const { error: insertError } = await getTable(req, "doe_records").insert({
      requirement_id: requirementId,
      testing_protocol: template.testing_protocol,
      sample_size: template.sample_size,
      sample_size_justification: template.sample_size_justification,
      baseline_data: { metrics: template.baseline_metrics || [] },
      beneficiary_profiles: template.beneficiary_criteria || [],
      pre_test_data: { measures: template.pre_test_measures || [] },
      post_test_data: { measures: template.post_test_measures || [] },
      improvement_metrics: template.improvement_metrics || [],
      statistical_analysis: {
        methods: template.statistical_methods || [],
        estimated_duration_weeks: template.estimated_duration_weeks,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) throw insertError;

    return res.status(200).json({ success: true, template });
  } catch (error: any) {
    console.error("aiDoeTemplate error:", error);
    const message = error?.message || "Unknown error";
    const status = message === "Authentication is required." ? 401 : getErrorStatus(error);
    return res.status(status).json({ error: message });
  }
}
