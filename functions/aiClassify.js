const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { VertexAI } = require("@google-cloud/vertexai");

const project = process.env.GCLOUD_PROJECT;

exports.aiClassify = onCall(async (request) => {
  try {
    const { requirementId } = request.data;
    if (!requirementId) {
      throw new HttpsError("invalid-argument", "requirementId is required");
    }

    const db = getFirestore();
    const reqRef = db.collection("requirements").doc(requirementId);
    const reqDoc = await reqRef.get();

    if (!reqDoc.exists) {
      throw new HttpsError("not-found", "Requirement not found");
    }

    const requirement = reqDoc.data();

    const vertexAI = new VertexAI({ project, location: "us-central1" });
    const model = vertexAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new HttpsError("internal", "No classification returned from AI");
    }

    const classification = JSON.parse(responseText);

    // Update requirement with AI classification in Firestore
    await reqRef.update({
      tech_level: classification.tech_level,
      priority: classification.priority,
      therapy_domains: classification.therapy_domains,
      disability_types: classification.disability_types,
      gap_flags: classification.gap_flags,
    });

    return { success: true, classification };

  } catch (error) {
    console.error("aiClassify error:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "An unexpected error occurred");
  }
});
