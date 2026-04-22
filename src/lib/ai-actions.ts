import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where } from "firebase/firestore";
import { invokeAiApi, canUseBrowserGemini } from "./ai-client";
import { getGeminiModel } from "./gemini";

const useBrowserGemini = () => canUseBrowserGemini;

export const aiClassify = async (requirementId: string) => {
  if (!useBrowserGemini()) {
    return invokeAiApi<{ success: boolean; classification: Record<string, any> }>("/api/aiClassify", { requirementId });
  }

  const reqRef = doc(db, "requirements", requirementId);
  const reqDoc = await getDoc(reqRef);
  if (!reqDoc.exists()) throw new Error("Requirement not found");
  const requirement = reqDoc.data();

  const model = getGeminiModel();
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

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });

  const responseText = result.response.text();
  if (!responseText) throw new Error("No classification returned from AI");

  const classification = JSON.parse(responseText);

  await updateDoc(reqRef, {
    tech_level: classification.tech_level || requirement.tech_level,
    priority: classification.priority || requirement.priority,
    therapy_domains: classification.therapy_domains || [],
    disability_types: classification.disability_types || [],
    gap_flags: classification.gap_flags || [],
  });

  return { classification };
};

export const aiDoeTemplate = async (requirementId: string) => {
  if (!useBrowserGemini()) {
    return invokeAiApi<{ success: boolean; template: Record<string, any> }>("/api/aiDoeTemplate", { requirementId });
  }

  const reqDoc = await getDoc(doc(db, "requirements", requirementId));
  if (!reqDoc.exists()) throw new Error("Requirement not found");
  const requirement = reqDoc.data();

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

  const model = getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
  });

  const responseText = result.response.text();
  if (!responseText) throw new Error("No template returned from AI");
  const template = JSON.parse(responseText);

  await addDoc(collection(db, "doe_records"), {
    requirement_id: requirementId,
    testing_protocol: template.testing_protocol,
    sample_size: template.sample_size,
    baseline_data: { metrics: template.baseline_metrics },
    beneficiary_profiles: template.beneficiary_criteria,
    pre_test_data: { measures: template.pre_test_measures },
    post_test_data: { measures: template.post_test_measures },
    improvement_metrics: template.improvement_metrics,
    statistical_analysis: { methods: template.statistical_methods, estimated_duration_weeks: template.estimated_duration_weeks },
    created_at: new Date().toISOString(),
  });

  return { template };
};

export const aiDeviceDoc = async (requirementId: string) => {
  if (!useBrowserGemini()) {
    return invokeAiApi<{ document: string; requirement?: Record<string, any> }>("/api/aiDeviceDoc", { requirementId });
  }

  const [reqDoc, transSnap, fbSnap, doeSnap, decSnap, reviewsSnap, filesSnap] = await Promise.all([
    getDoc(doc(db, "requirements", requirementId)),
    getDocs(query(collection(db, "state_transitions"), where("requirement_id", "==", requirementId), orderBy("created_at"))),
    getDocs(query(collection(db, "phase_feedbacks"), where("requirement_id", "==", requirementId), orderBy("created_at"))),
    getDocs(query(collection(db, "doe_records"), where("requirement_id", "==", requirementId), limit(1))),
    getDocs(query(collection(db, "committee_decisions"), where("requirement_id", "==", requirementId), orderBy("created_at", "desc"), limit(1))),
    getDocs(query(collection(db, "committee_reviews"), where("requirement_id", "==", requirementId))),
    getDocs(query(collection(db, "requirement_files"), where("requirement_id", "==", requirementId))),
  ]);

  if (!reqDoc.exists()) throw new Error("Requirement not found");

  const requirement = reqDoc.data();
  const transitions = transSnap.docs.map((item) => item.data());
  const feedbacks = fbSnap.docs.map((item) => item.data());
  const doe = doeSnap.empty ? null : doeSnap.docs[0].data();
  const decision = decSnap.empty ? null : decSnap.docs[0].data();
  const reviews = reviewsSnap.docs.map((item) => item.data());
  const files = filesSnap.docs.map((item) => item.data());

  const prompt = `You are a technical documentation specialist for assistive technology devices at STRIDE COE. Generate a comprehensive Device Documentation Package in markdown format. This should be professional and publication-ready.

## Requirement Data
- Title: ${requirement.title}
- Description: ${requirement.description || "N/A"}
- Source: ${requirement.source_type}, Priority: ${requirement.priority}, Tech Level: ${requirement.tech_level}
- Disability Types: ${(requirement.disability_types || []).join(", ") || "N/A"}
- Therapy Domains: ${(requirement.therapy_domains || []).join(", ") || "N/A"}
- Path: ${requirement.path_assignment || "N/A"}, State: ${requirement.current_state}

## Transitions (${transitions.length})
${transitions.map((transition) => `- ${transition.from_state} → ${transition.to_state}: ${transition.notes || "No notes"}`).join("\n")}

## Phase Feedbacks (${feedbacks.length})
${feedbacks.map((feedback) => `- ${feedback.from_state} → ${feedback.to_state}: ${feedback.phase_notes || "No notes"}`).join("\n")}

## DoE Record
${doe ? `Protocol: ${doe.testing_protocol || "N/A"}, Sample Size: ${doe.sample_size || "N/A"}, Results: ${doe.results_summary || "N/A"}` : "No DoE record."}

## Reviews (${reviews.length})
${reviews.map((review) => `- Score: ${review.weighted_total}. Rec: ${review.recommendation}`).join("\n") || "None"}

## Decision
${decision ? `${decision.decision}. Conditions: ${decision.conditions || "None"}` : "No decision yet."}

## Files (${files.length})
${files.map((file) => `- ${file.file_name} (${file.file_type})`).join("\n") || "None"}

Generate sections: Cover Page, Executive Summary, Device Specification, Market Analysis, Design Journey, DoE Report, Committee Review, Risk Assessment, Production Readiness Checklist, Appendices. Use markdown tables where appropriate.`;

  const model = getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3 },
  });

  return { document: result.response.text() || "Failed to generate document." };
};

export const aiDuplicateCheck = async (title: string, description: string) => {
  if (!useBrowserGemini()) {
    return invokeAiApi<{ duplicates: Array<Record<string, any>> }>("/api/aiDuplicateCheck", { title, description });
  }

  const existingSnap = await getDocs(query(collection(db, "requirements"), limit(200)));
  if (existingSnap.empty) return { duplicates: [] };

  const existingList = existingSnap.docs
    .map((item) => {
      const requirement = item.data();
      return `[${item.id}] "${requirement.title}" — ${requirement.description || "No description"} (State: ${requirement.current_state})`;
    })
    .join("\n");

  const prompt = `You are a duplicate detection expert for assistive technology requirements. Compare the NEW requirement against the EXISTING list and find potential duplicates or very similar items. Consider semantic similarity, not just exact text matches.

NEW REQUIREMENT:
Title: ${title}
Description: ${description || "None"}

EXISTING REQUIREMENTS:
${existingList}

Return JSON with: { "duplicates": [{ "id": "UUID", "title": "...", "similarity": "exact|high|moderate", "reason": "..." }] }
Return empty duplicates array if no duplicates found.`;

  const model = getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });

  const responseText = result.response.text();
  if (!responseText) return { duplicates: [] };

  return JSON.parse(responseText);
};

export const aiMonthlyReport = async (month: string) => {
  if (!useBrowserGemini()) {
    return invokeAiApi<{ success: boolean; report: string; data: Record<string, any> }>("/api/aiMonthlyReport", { month });
  }

  const reqSnap = await getDocs(collection(db, "requirements"));
  const requirements = reqSnap.docs.map((item) => item.data());

  const transSnap = await getDocs(query(
    collection(db, "state_transitions"),
    where("created_at", ">=", `${month}-01T00:00:00.000Z`),
    where("created_at", "<", `${month}-31T23:59:59.999Z`),
  ));

  const transitions = transSnap.docs.map((item) => item.data());

  const monthRequirements = requirements.filter((requirement) => requirement.created_at && requirement.created_at.slice(0, 7) <= month);
  const newThisMonth = requirements.filter((requirement) => requirement.created_at && requirement.created_at.slice(0, 7) === month);
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

  const model = getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3 },
  });

  const report = result.response.text();
  if (!report) throw new Error("No report generated from AI");

  return { report };
};
