const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { VertexAI } = require("@google-cloud/vertexai");

const project = process.env.GCLOUD_PROJECT;

exports.aiDeviceDoc = onCall({ timeoutSeconds: 120 }, async (request) => {
  try {
    const { requirementId } = request.data;
    if (!requirementId) {
      throw new HttpsError("invalid-argument", "requirementId is required");
    }

    const db = getFirestore();

    // Fetch all related data in parallel from Firestore
    const [reqDoc, transSnap, fbSnap, doeSnap, decSnap, reviewsSnap, filesSnap] = await Promise.all([
      db.collection("requirements").doc(requirementId).get(),
      db.collection("state_transitions").where("requirement_id", "==", requirementId).orderBy("created_at").get(),
      db.collection("phase_feedbacks").where("requirement_id", "==", requirementId).orderBy("created_at").get(),
      db.collection("doe_records").where("requirement_id", "==", requirementId).limit(1).get(),
      db.collection("committee_decisions").where("requirement_id", "==", requirementId).orderBy("created_at", "desc").limit(1).get(),
      db.collection("committee_reviews").where("requirement_id", "==", requirementId).get(),
      db.collection("requirement_files").where("requirement_id", "==", requirementId).get(),
    ]);

    if (!reqDoc.exists) {
      throw new HttpsError("not-found", "Requirement not found");
    }

    const r = reqDoc.data();
    const transitions = transSnap.docs.map(doc => doc.data());
    const feedbacks = fbSnap.docs.map(doc => doc.data());
    const doe = doeSnap.empty ? null : doeSnap.docs[0].data();
    const decision = decSnap.empty ? null : decSnap.docs[0].data();
    const reviews = reviewsSnap.docs.map(doc => doc.data());
    const files = filesSnap.docs.map(doc => doc.data());

    const prompt = `You are a technical documentation specialist for assistive technology devices at STRIDE COE. Generate a comprehensive Device Documentation Package in markdown format. This should be professional and publication-ready.

## Requirement Data
- Title: ${r.title}
- Description: ${r.description || "N/A"}
- Source: ${r.source_type}, Priority: ${r.priority}, Tech Level: ${r.tech_level}
- Disability Types: ${(r.disability_types || []).join(", ") || "N/A"}
- Therapy Domains: ${(r.therapy_domains || []).join(", ") || "N/A"}
- Gap Flags: ${(r.gap_flags || []).join(", ") || "None"}
- Market Price: ${r.market_price ? `$${r.market_price}` : "N/A"}, Target: ${r.stride_target_price ? `$${r.stride_target_price}` : "N/A"}
- Path: ${r.path_assignment || "N/A"}, State: ${r.current_state}, Revision: #${r.revision_number}

## Transitions (${transitions.length})
${transitions.map(t => `- ${t.from_state} → ${t.to_state}: ${t.notes || "No notes"}`).join("\n")}

## Phase Feedbacks (${feedbacks.length})
${feedbacks.map(f => `- ${f.from_state} → ${f.to_state}: ${f.phase_notes || "No notes"}`).join("\n")}

## DoE Record
${doe ? `Protocol: ${doe.testing_protocol || "N/A"}, Sample Size: ${doe.sample_size || "N/A"}, Results: ${doe.results_summary || "N/A"}` : "No DoE record."}

## Reviews (${reviews.length})
${reviews.map(rv => `- Safety=${rv.safety_score}, Tech=${rv.technical_feasibility_score}, Cost=${rv.cost_effectiveness_score}, Need=${rv.user_need_score}, DoE=${rv.doe_results_score}, Total=${rv.weighted_total}. Rec: ${rv.recommendation}`).join("\n") || "None"}

## Decision
${decision ? `${decision.decision}. Conditions: ${decision.conditions || "None"}` : "No decision yet."}

## Files (${files.length})
${files.map(f => `- ${f.file_name} (${f.file_type})`).join("\n") || "None"}

Generate sections: Cover Page, Executive Summary, Device Specification, Market Analysis, Design Journey, DoE Report, Committee Review, Risk Assessment, Production Readiness Checklist, Appendices. Use markdown tables where appropriate.`;

    const vertexAI = new VertexAI({ project, location: "us-central1" });
    const model = vertexAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    });

    const document = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "Failed to generate document.";

    return { document, requirement: r };
  } catch (error) {
    console.error("aiDeviceDoc error:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Unknown error");
  }
});
