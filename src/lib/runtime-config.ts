const firstNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
};

export const STRIDE_SUPABASE_URL = "https://jeljvxuypgvkjactfhif.supabase.co";
export const STRIDE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_DX8ukhFNMqhvtAho56FASQ_JzSKDXLH";

export const resolveSupabaseUrl = (...values: Array<string | null | undefined>) =>
  firstNonEmpty(...values, STRIDE_SUPABASE_URL);

export const resolveSupabasePublishableKey = (...values: Array<string | null | undefined>) =>
  firstNonEmpty(...values, STRIDE_SUPABASE_PUBLISHABLE_KEY);

export const resolveOptionalFlag = (...values: Array<string | null | undefined>) => firstNonEmpty(...values);
