import type { VercelRequest, VercelResponse } from '@vercel/node';
import { VertexAI } from '@google-cloud/vertexai';
import admin from 'firebase-admin';

// Initialize Firebase Admin lazily
if (!admin.apps.length) {
    // In Vercel, you should set these in your project settings:
    // FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
    } else {
        // Fallback for local dev if emulator/ADC is running
        admin.initializeApp();
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are accepted' });
    }

    try {
        const { requirementId } = req.body;
        if (!requirementId) {
            return res.status(400).json({ error: 'invalid-argument', message: 'requirementId is required' });
        }

        const db = admin.firestore();
        const reqRef = db.collection("requirements").doc(requirementId);
        const reqDoc = await reqRef.get();

        if (!reqDoc.exists) {
            return res.status(404).json({ error: 'not-found', message: 'Requirement not found' });
        }

        const requirement = reqDoc.data()!;

        // Vercel project needs GCLOUD_PROJECT set for Vertex AI
        const project = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
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
            return res.status(500).json({ error: 'internal', message: 'No classification returned from AI' });
        }

        const classification = JSON.parse(responseText);

        await reqRef.update({
            tech_level: classification.tech_level,
            priority: classification.priority,
            therapy_domains: classification.therapy_domains,
            disability_types: classification.disability_types,
            gap_flags: classification.gap_flags,
        });

        return res.status(200).json({ success: true, classification });

    } catch (error: any) {
        console.error("aiClassify error:", error);
        return res.status(500).json({ error: 'internal', message: error.message || 'An unexpected error occurred' });
    }
}
