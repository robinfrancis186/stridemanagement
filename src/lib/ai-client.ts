import { hasSupabaseConfig, supabase } from "./supabase";

export const canUseBrowserGemini = import.meta.env.DEV && Boolean(import.meta.env.VITE_GEMINI_API_KEY);

const getAuthHeaders = async () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (hasSupabaseConfig && supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You must be signed in to use AI features.");
    }

    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return headers;
};

export const invokeAiApi = async <T>(path: string, payload: Record<string, unknown>) => {
  const response = await fetch(path, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.message === "string"
        ? data.message
        : typeof data?.error === "string"
          ? data.error
          : `Request failed with status ${response.status}`;

    if (
      response.status === 503 ||
      /service unavailable|high demand|temporar(?:y|ily)|overload|rate limit/i.test(message)
    ) {
      throw new Error("AI service is currently busy. Please try again in a moment.");
    }

    throw new Error(
      message,
    );
  }

  return data as T;
};
