import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateText, getErrorStatus } from "./_ai.js";
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

    const [
      requirementResult,
      transitionsResult,
      feedbacksResult,
      doeResult,
      decisionsResult,
      reviewsResult,
      filesResult,
    ] = await Promise.all([
      getTable(req, "requirements").select("*").eq("id", requirementId).maybeSingle(),
      getTable(req, "state_transitions").select("*").eq("requirement_id", requirementId).order("created_at"),
      getTable(req, "phase_feedbacks").select("*").eq("requirement_id", requirementId).order("created_at"),
      getTable(req, "doe_records").select("*").eq("requirement_id", requirementId).limit(1),
      getTable(req, "committee_decisions").select("*").eq("requirement_id", requirementId).order("created_at", { ascending: false }).limit(1),
      getTable(req, "committee_reviews").select("*").eq("requirement_id", requirementId),
      getTable(req, "requirement_files").select("*").eq("requirement_id", requirementId),
    ]);

    const errors = [
      requirementResult.error,
      transitionsResult.error,
      feedbacksResult.error,
      doeResult.error,
      decisionsResult.error,
      reviewsResult.error,
      filesResult.error,
    ].filter(Boolean);
    if (errors.length > 0) throw errors[0];

    const requirement = requirementResult.data;
    if (!requirement) {
      return res.status(404).json({ error: "Requirement not found" });
    }

    const transitions = transitionsResult.data ?? [];
    const feedbacks = feedbacksResult.data ?? [];
    const doe = doeResult.data?.[0] ?? null;
    const decision = decisionsResult.data?.[0] ?? null;
    const reviews = reviewsResult.data ?? [];
    const files = filesResult.data ?? [];

    const prompt = `You are a technical documentation specialist for assistive technology devices at STRIDE COE. Generate a comprehensive Device Documentation Package in markdown format. This should be professional and publication-ready.

## Requirement Data
- Title: ${requirement.title}
- Description: ${requirement.description || "N/A"}
- Source: ${requirement.source_type}, Priority: ${requirement.priority}, Tech Level: ${requirement.tech_level}
- Disability Types: ${(requirement.disability_types || []).join(", ") || "N/A"}
- Therapy Domains: ${(requirement.therapy_domains || []).join(", ") || "N/A"}
- Gap Flags: ${(requirement.gap_flags || []).join(", ") || "None"}
- Market Price: ${requirement.market_price ? `$${requirement.market_price}` : "N/A"}, Target: ${requirement.stride_target_price ? `$${requirement.stride_target_price}` : "N/A"}
- Path: ${requirement.path_assignment || "N/A"}, State: ${requirement.current_state}, Revision: #${requirement.revision_number}

## Transitions (${transitions.length})
${transitions.map((transition) => `- ${transition.from_state} → ${transition.to_state}: ${transition.notes || "No notes"}`).join("\n")}

## Phase Feedbacks (${feedbacks.length})
${feedbacks.map((feedback) => `- ${feedback.from_state} → ${feedback.to_state}: ${feedback.phase_notes || "No notes"}`).join("\n")}

## DoE Record
${doe ? `Protocol: ${doe.testing_protocol || "N/A"}, Sample Size: ${doe.sample_size || "N/A"}, Results: ${doe.results_summary || "N/A"}` : "No DoE record."}

## Reviews (${reviews.length})
${reviews.map((review) => `- Safety=${review.safety_score}, Tech=${review.technical_feasibility_score}, Cost=${review.cost_effectiveness_score}, Need=${review.user_need_score}, DoE=${review.doe_results_score}, Total=${review.weighted_total}. Rec: ${review.recommendation}`).join("\n") || "None"}

## Decision
${decision ? `${decision.decision}. Conditions: ${decision.conditions || "None"}` : "No decision yet."}

## Files (${files.length})
${files.map((file) => `- ${file.file_name} (${file.file_type})`).join("\n") || "None"}

Generate sections: Cover Page, Executive Summary, Device Specification, Market Analysis, Design Journey, DoE Report, Committee Review, Risk Assessment, Production Readiness Checklist, Appendices. Use markdown tables where appropriate.`;

    const document = await generateText([{ text: prompt }], { temperature: 0.3 });

    return res.status(200).json({
      document: document || "Failed to generate document.",
      requirement,
    });
  } catch (error: any) {
    console.error("aiDeviceDoc error:", error);
    const message = error?.message || "Unknown error";
    const status = message === "Authentication is required." ? 401 : getErrorStatus(error);
    return res.status(status).json({ error: message });
  }
}
