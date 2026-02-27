import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY is not set. AI features may not work properly.");
}

export const genAI = new GoogleGenerativeAI(apiKey || "");

// Default model to use
export const getGeminiModel = () => {
    return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
};
