import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";

const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

const getModel = () => {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const client = new GoogleGenerativeAI(geminiApiKey);
  return client.getGenerativeModel({ model: "gemini-2.5-flash" });
};

export const generateText = async (parts: Array<Record<string, unknown>>, generationConfig?: GenerationConfig) => {
  const model = getModel();
  const request = {
    contents: [{ role: "user", parts }],
    generationConfig,
  } as any;
  const result = await model.generateContent(request);

  return result.response.text() ?? "";
};

export const generateJson = async <T>(parts: Array<Record<string, unknown>>, generationConfig?: GenerationConfig) => {
  const text = await generateText(parts, {
    responseMimeType: "application/json",
    temperature: 0.2,
    ...generationConfig,
  });

  if (!text) {
    throw new Error("No response returned from Gemini.");
  }

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned) as T;
};
