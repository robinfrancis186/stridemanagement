import { VercelRequest, VercelResponse } from '@vercel/node';
import { VertexAI } from '@google-cloud/vertexai';
import { db } from './_firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { title, description } = req.body;
        if (!title) return res.status(400).json({ error: 'title is required' });

        const existingSnap = await db.collection("requirements")
            .select("title", "description", "current_state", "therapy_domains", "disability_types")
            .limit(200)
            .get();

        if (existingSnap.empty) {
            return res.status(200).json({ duplicates: [] });
        }

        const existingList = existingSnap.docs.map(doc => {
            const r = doc.data();
            return `[${doc.id}] "${r.title}" — ${r.description || "No description"} (State: ${r.current_state})`;
        }).join("\n");

        const project = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
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
            return res.status(200).json({ duplicates: [] });
        }

        const parsed = JSON.parse(responseText);
        return res.status(200).json(parsed);

    } catch (error: any) {
        console.error("aiDuplicateCheck error:", error);
        return res.status(500).json({ error: error.message || "Unknown error" });
    }
}
