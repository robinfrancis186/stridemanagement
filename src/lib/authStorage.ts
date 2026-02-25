const SUPABASE_STORAGE_PREFIX = "sb-";
const AUTH_TOKEN_SUFFIX = "-auth-token";

type StoredAuthToken = {
  access_token?: string;
  refresh_token?: string;
  currentSession?: {
    access_token?: string;
    refresh_token?: string;
  } | null;
};

const isSupabaseAuthTokenKey = (key: string) =>
  key.startsWith(SUPABASE_STORAGE_PREFIX) && key.endsWith(AUTH_TOKEN_SUFFIX);

const extractSession = (parsed: StoredAuthToken | null | undefined) =>
  parsed?.currentSession ?? parsed ?? null;

const hasValidTokens = (parsed: StoredAuthToken | null | undefined) => {
  const session = extractSession(parsed);
  return Boolean(
    session?.access_token &&
      session?.refresh_token &&
      session.refresh_token.length >= 20
  );
};

export const clearSupabaseStorageKeys = () => {
  if (typeof window === "undefined") return;

  Object.keys(localStorage)
    .filter((key) => key.startsWith(SUPABASE_STORAGE_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
};

export const clearCorruptAuthTokenKeys = () => {
  if (typeof window === "undefined") return;

  Object.keys(localStorage)
    .filter(isSupabaseAuthTokenKey)
    .forEach((key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) {
          localStorage.removeItem(key);
          return;
        }

        const parsed = JSON.parse(raw) as StoredAuthToken;
        if (!hasValidTokens(parsed)) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    });
};
