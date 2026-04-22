import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";

class AiConfigError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
    this.status = 503;
  }
}

class AiTransientError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.name = "AiTransientError";
    this.status = 503;
  }
}

const geminiApiKey = (process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY)?.trim();
const retryableStatusCodes = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getNumericStatus = (error: unknown) => {
  if (typeof error === "object" && error) {
    if ("status" in error && typeof error.status === "number") {
      return error.status;
    }

    if ("status" in error && typeof error.status === "string") {
      const parsed = Number(error.status);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "";
};

const isRetryableAiError = (error: unknown) => {
  const status = getNumericStatus(error);
  if (status !== null && retryableStatusCodes.has(status)) {
    return true;
  }

  const message = getErrorMessage(error);
  return /service unavailable|high demand|temporar(?:y|ily)|overload|rate limit|deadline exceeded|fetching from/i.test(message);
};

const getModel = () => {
  if (!geminiApiKey) {
    throw new AiConfigError("AI server is not configured. Set GEMINI_API_KEY in the deployment environment.");
  }

  const client = new GoogleGenerativeAI(geminiApiKey);
  return client.getGenerativeModel({ model: "gemini-2.5-flash" });
};

export const getErrorStatus = (error: unknown) => {
  const status = getNumericStatus(error);
  if (status !== null) {
    return status;
  }

  return 500;
};

const generateWithRetry = async (request: Record<string, unknown>) => {
  const model = getModel();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await model.generateContent(request as any);
    } catch (error) {
      if (!isRetryableAiError(error)) {
        throw error;
      }

      if (attempt === 2) {
        break;
      }

      await sleep(800 * (attempt + 1));
    }
  }

  throw new AiTransientError("AI service is currently busy. Please try again in a moment.");
};

export const generateText = async (parts: Array<Record<string, unknown>>, generationConfig?: GenerationConfig) => {
  const request = {
    contents: [{ role: "user", parts }],
    generationConfig,
  } as any;
  const result = await generateWithRetry(request);

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
