const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { VertexAI } = require("@google-cloud/vertexai");

const project = process.env.GCLOUD_PROJECT;

exports.aiDoeTemplate = onCall(async (request) => {
  try {
    const { requirementId } = request.data;
    if (!requirementId) {
      throw new HttpsError("invalid-argument", "requirementId is required");
    }

    const db = getFirestore();
    const reqDoc = await db.collection("requirements").doc(requirementId).get();

    if (!reqDoc.exists) {
      throw new HttpsError("not-found", "Requirement not found");
    }

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

    const vertexAI = new VertexAI({ project, location: "us-central1" });
    const model = vertexAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new HttpsError("internal", "No template returned from AI");
    }

    const template = JSON.parse(responseText);

    // Save DoE record
    await db.collection("doe_records").add({
      requirement_id: requirementId,
      testing_protocol: template.testing_protocol,
      sample_size: template.sample_size,
      baseline_data: { metrics: template.baseline_metrics },
      beneficiary_profiles: template.beneficiary_criteria,
      pre_test_data: { measures: template.pre_test_measures },
      post_test_data: { measures: template.post_test_measures },
      improvement_metrics: template.improvement_metrics,
      statistical_analysis: { methods: template.statistical_methods, estimated_duration_weeks: template.estimated_duration_weeks },
    });

    return { success: true, template };
  } catch (error) {
    console.error("aiDoeTemplate error:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Unknown error");
  }
});
