const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { VertexAI } = require("@google-cloud/vertexai");

const project = process.env.GCLOUD_PROJECT;

exports.aiDuplicateCheck = onCall(async (request) => {
  try {
    const { title, description } = request.data;
    if (!title) {
      throw new HttpsError("invalid-argument", "title is required");
    }

    const db = getFirestore();

    const existingSnap = await db.collection("requirements")
      .select("title", "description", "current_state", "therapy_domains", "disability_types")
      .limit(200)
      .get();

    if (existingSnap.empty) {
      return { duplicates: [] };
    }

    const existingList = existingSnap.docs.map(doc => {
      const r = doc.data();
      return `[${doc.id}] "${r.title}" — ${r.description || "No description"} (State: ${r.current_state})`;
    }).join("\n");

    const vertexAI = new VertexAI({ project, location: "us-central1" });
    const model = vertexAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are a duplicate detection expert for assistive technology requirements. Compare the NEW requirement against the EXISTING list and find potential duplicates or very similar items. Consider semantic similarity, not just exact text matches.

NEW REQUIREMENT:
Title: ${title}
Description: ${description || "None"}

EXISTING REQUIREMENTS:
${existingList}

Return JSON with: { "duplicates": [{ "id": "UUID", "title": "...", "similarity": "exact|high|moderate", "reason": "..." }] }
Return empty duplicates array if no duplicates found.`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      return { duplicates: [] };
    }

    const parsed = JSON.parse(responseText);
    return parsed;

  } catch (error) {
    console.error("aiDuplicateCheck error:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Unknown error");
  }
});
