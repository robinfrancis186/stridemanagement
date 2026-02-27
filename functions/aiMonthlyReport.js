const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { VertexAI } = require("@google-cloud/vertexai");

const project = process.env.GCLOUD_PROJECT;

exports.aiMonthlyReport = onCall({ timeoutSeconds: 120 }, async (request) => {
  try {
    const { month } = request.data;
    if (!month) {
      throw new HttpsError("invalid-argument", "month is required (YYYY-MM)");
    }

    const db = getFirestore();

    const reqSnap = await db.collection("requirements").get();
    const requirements = reqSnap.docs.map(doc => doc.data());

    // Fetch transitions for the month
    const transSnap = await db.collection("state_transitions")
      .where("created_at", ">=", `${month}-01T00:00:00.000Z`)
      .where("created_at", "<", `${month}-31T23:59:59.999Z`)
      .get();

    const transitions = transSnap.docs.map(doc => doc.data());

    const monthReqs = requirements.filter(r => r.created_at && r.created_at.slice(0, 7) <= month);
    const newThisMonth = requirements.filter(r => r.created_at && r.created_at.slice(0, 7) === month);
    const productionReady = monthReqs.filter(r => r.current_state === "H-DOE-5");

    // Aging analysis
    const aging = monthReqs.filter(r => {
      const updatedAt = r.updated_at ? new Date(r.updated_at).getTime() : Date.now();
      const days = (Date.now() - updatedAt) / 86400000;
      const s = r.current_state;
      if (!s) return false;
      if (s.startsWith("S") && days > 14) return true;
      if (s.startsWith("H-INT") && days > 60) return true;
      if (s.startsWith("H-DES") && days > 90) return true;
      if (s.startsWith("H-DOE") && days > 45) return true;
      return false;
    });

    const dataForAI = {
      month,
      total_pipeline: monthReqs.length,
      new_this_month: newThisMonth.length,
      production_ready: productionReady.length,
      transitions_this_month: transitions.length,
      aging_alerts: aging.length,
      aging_items: aging.map(r => ({
        title: r.title,
        state: r.current_state,
        days_stuck: Math.round((Date.now() - new Date(r.updated_at).getTime()) / 86400000),
      })),
      state_distribution: Object.entries(
        monthReqs.reduce((acc, r) => {
          acc[r.current_state] = (acc[r.current_state] || 0) + 1;
          return acc;
        }, {})
      ).map(([state, count]) => ({ state, count })),
      priority_distribution: Object.entries(
        monthReqs.reduce((acc, r) => {
          acc[r.priority] = (acc[r.priority] || 0) + 1;
          return acc;
        }, {})
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

    const vertexAI = new VertexAI({ project, location: "us-central1" });
    const model = vertexAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    });

    const reportContent = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reportContent) {
      throw new HttpsError("internal", "No report generated from AI");
    }

    return { success: true, report: reportContent, data: dataForAI };

  } catch (error) {
    console.error("aiMonthlyReport error:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Unknown error");
  }
});
