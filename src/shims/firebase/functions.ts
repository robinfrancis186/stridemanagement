import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export const getFunctions = (_app?: unknown, _region?: string) => ({ kind: "dual-functions" as const });

export const httpsCallable = (_functions: unknown, name: string) => {
  return async (data: unknown) => {
    if (hasSupabaseConfig && supabase) {
      const { data: result, error } = await supabase.functions.invoke(name, { body: data });
      if (error) throw error;
      return { data: result };
    }

    return {
      data: {
        ok: false,
        name,
        input: data,
        message: "Edge function unavailable because Supabase is not configured.",
      },
    };
  };
};
