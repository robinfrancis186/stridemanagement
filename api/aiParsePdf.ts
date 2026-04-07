import { VercelRequest, VercelResponse } from '@vercel/node';
import { VertexAI } from '@google-cloud/vertexai';
import { storage } from './_firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { text, base64, storagePath, fileName, fileType } = req.body;

        if (!text && !base64 && !storagePath) {
            return res.status(400).json({ error: 'invalid-argument', message: 'Either text, base64, or storagePath is required' });
        }

        let fileBase64 = base64;
        if (storagePath && !fileBase64) {
            const bucket = storage.bucket();
            const file = bucket.file(storagePath);

            const [exists] = await file.exists();
            if (!exists) {
                return res.status(404).json({ error: 'not-found', message: `File not found in storage: ${storagePath}` });
            }

            const [buffer] = await file.download();
            fileBase64 = buffer.toString('base64');

            // Clean up temp file after download
            await file.delete().catch(console.error);
        }

        const project = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
        const vertexAI = new VertexAI({ project, location: "us-central1" });
        const model = vertexAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const systemPrompt = `You are an expert at extracting structured requirement data from documents for STRIDE COE assistive technology pipeline.

Extract all identifiable requirements from the document. For each requirement, extract:
- title: concise device/requirement name
- description: detailed description
- source_type: one of CDC, SEN, BLIND, ELDERLY, BUDS, OTHER
- priority: P1 (urgent), P2 (standard), P3 (low)
- tech_level: LOW, MEDIUM, HIGH
- therapy_domains: array from [OT, PT, Speech, ADL, Sensory, Cognitive]
- disability_types: array from [Physical, Visual, Hearing, Cognitive, Multiple]
- gap_flags: array from [RED, BLUE] or empty
- market_price: number or null
- stride_target_price: number or null

Be thorough and extract every requirement you can identify.
Return your response as valid JSON with this structure:
{
  "requirements": [...],
  "summary": "Brief summary of what was extracted"
}`;

        let parts: any[] = [];

        if (fileBase64 && (fileType === "pdf" || fileType === "docx")) {
            const mimeType = fileType === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            parts = [
                { text: `${systemPrompt}\n\nExtract all requirements from this uploaded ${fileType.toUpperCase()} document.` },
                {
                    inlineData: {
                        mimeType,
                        data: fileBase64,
                    },
                },
            ];
        } else {
            parts = [
                { text: `${systemPrompt}\n\nExtract requirements from this document text:\n\n${(text || "").slice(0, 15000)}` },
            ];
        }

        const result = await model.generateContent({
            contents: [{ role: "user", parts }],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2,
            },
        });

        const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
            return res.status(500).json({ error: 'internal', message: "No extraction returned from AI" });
        }

        const extracted = JSON.parse(responseText);
        return res.status(200).json({ success: true, ...extracted });

    } catch (error: any) {
        console.error("aiParsePdf error:", error);
        return res.status(500).json({ error: 'internal', message: error.message || "An unexpected error occurred" });
    }
}
