import { createClient } from "@supabase/supabase-js";
import {
  resolveOptionalFlag,
  resolveSupabasePublishableKey,
  resolveSupabaseUrl,
} from "./runtime-config";

const forcedLocalBackend = resolveOptionalFlag(import.meta.env.VITE_ENABLE_LOCAL_BACKEND) === "true";
const supabaseUrl = forcedLocalBackend ? null : resolveSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = forcedLocalBackend
  ? null
  : resolveSupabasePublishableKey(
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
    );

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const isLocalBackendEnabled = forcedLocalBackend || !hasSupabaseConfig;

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const getSiteUrl = (path = "/") => {
  const url = new URL(path, window.location.origin);
  return url.toString();
};
