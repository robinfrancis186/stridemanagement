import type { VercelRequest } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import {
  resolveSupabasePublishableKey,
  resolveSupabaseUrl,
} from "../src/lib/runtime-config";

const supabaseUrl = resolveSupabaseUrl(process.env.VITE_SUPABASE_URL);
const supabaseKey = resolveSupabasePublishableKey(
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  process.env.VITE_SUPABASE_ANON_KEY,
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
