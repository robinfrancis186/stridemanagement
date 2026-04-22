import type { VercelRequest } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const firstNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
};

const STRIDE_SUPABASE_URL = "https://jeljvxuypgvkjactfhif.supabase.co";
const STRIDE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_DX8ukhFNMqhvtAho56FASQ_JzSKDXLH";

const supabaseUrl = firstNonEmpty(process.env.VITE_SUPABASE_URL, STRIDE_SUPABASE_URL);
const supabaseKey = firstNonEmpty(
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  process.env.VITE_SUPABASE_ANON_KEY,
  STRIDE_SUPABASE_PUBLISHABLE_KEY,
);

const getBearerToken = (req: VercelRequest) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim();
};

export const requireRequestAuth = (req: VercelRequest) => {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    throw new Error("Authentication is required.");
  }
  return accessToken;
};

export const getSupabaseForRequest = (req: VercelRequest) => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const accessToken = requireRequestAuth(req);

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
};

export const getTable = (req: VercelRequest, table: string) => getSupabaseForRequest(req).from(table);
