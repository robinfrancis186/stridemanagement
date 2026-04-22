import type { FirebaseApp } from "./app";
import {
  generateId,
  getCurrentUserRecord,
  mutateStore,
  notifyAuthListeners,
  subscribeAuth,
} from "./internal";
import { getSiteUrl, hasSupabaseConfig, supabase } from "@/lib/supabase";

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface Auth {
  app: FirebaseApp | null;
}

const authInstance: Auth = { app: null };

const toUser = (
  record:
    | {
        uid?: string;
        id?: string;
        email?: string | null;
        displayName?: string | null;
        display_name?: string | null;
        user_metadata?: Record<string, unknown> | null;
      }
    | null
    | undefined,
): User | null => {
  if (!record) return null;
  const uid = record.uid ?? record.id;
  if (!uid) return null;
  const metadata = record.user_metadata ?? {};
  const displayName =
    record.displayName ??
    record.display_name ??
    (typeof metadata.full_name === "string" ? metadata.full_name : null) ??
    (typeof metadata.display_name === "string" ? metadata.display_name : null) ??
    record.email?.split("@")[0] ??
    null;

  return {
    uid,
    email: record.email ?? null,
    displayName,
  };
};

export const getAuth = (app?: FirebaseApp): Auth => {
  authInstance.app = app ?? null;
  return authInstance;
};

export const onAuthStateChanged = (auth: Auth, callback: (user: User | null) => void) => {
  void auth;

  if (hasSupabaseConfig && supabase) {
    supabase.auth.getSession().then(({ data }) => callback(toUser(data.session?.user)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(toUser(session?.user));
    });
    return () => data.subscription.unsubscribe();
  }

  callback(toUser(getCurrentUserRecord()));
  return subscribeAuth((record) => callback(toUser(record)));
};

export const signOut = async (auth: Auth) => {
  void auth;

  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return;
  }

  mutateStore((store) => {
    store.sessionUserId = null;
  });
  notifyAuthListeners();
};

export const signInWithEmailAndPassword = async (auth: Auth, email: string, password: string) => {
  void auth;

  if (hasSupabaseConfig && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { user: toUser(data.user)! };
  }

  const normalizedEmail = email.trim().toLowerCase();
  let signedInUser: User | null = null;

  mutateStore((store) => {
    const match = Object.values(store.users).find(
      (user) => user.email.toLowerCase() === normalizedEmail && user.password === password,
    );
    if (!match) {
      const error = new Error("Invalid email or password.");
      (error as Error & { code?: string }).code = "auth/invalid-credential";
      throw error;
    }
    store.sessionUserId = match.uid;
    signedInUser = toUser(match);
  });

  notifyAuthListeners();
  return { user: signedInUser! };
};

export const createUserWithEmailAndPassword = async (auth: Auth, email: string, password: string) => {
  void auth;

  if (hasSupabaseConfig && supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getSiteUrl("/auth"),
      },
    });
    if (error) throw error;
    return { user: toUser(data.user)! };
  }

  const normalizedEmail = email.trim().toLowerCase();
  let createdUser: User | null = null;

  mutateStore((store) => {
    const exists = Object.values(store.users).some((user) => user.email.toLowerCase() === normalizedEmail);
    if (exists) {
      const error = new Error("An account with this email already exists.");
      (error as Error & { code?: string }).code = "auth/email-already-in-use";
      throw error;
    }

    const uid = generateId("user");
    const displayName = normalizedEmail.split("@")[0];
    store.users[uid] = { uid, email: normalizedEmail, password, displayName };
    store.sessionUserId = uid;
    createdUser = { uid, email: normalizedEmail, displayName };
  });

  notifyAuthListeners();
  return { user: createdUser! };
};

export const sendPasswordResetEmail = async (
  auth: Auth,
  email: string,
  actionCodeSettings?: { url?: string; handleCodeInApp?: boolean },
) => {
  void auth;

  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: actionCodeSettings?.url || getSiteUrl("/reset-password"),
    });
    if (error) throw error;
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  mutateStore((store) => {
    const user = Object.values(store.users).find((entry) => entry.email.toLowerCase() === normalizedEmail);
    if (!user) {
      const error = new Error("No account found for this email.");
      (error as Error & { code?: string }).code = "auth/user-not-found";
      throw error;
    }
    store.passwordResets[`local-reset-${user.uid}`] = user.uid;
  });
};

export const confirmPasswordReset = async (auth: Auth, code: string, newPassword: string) => {
  void auth;

  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return;
  }

  mutateStore((store) => {
    const userId = store.passwordResets[code];
    if (!userId || !store.users[userId]) {
      const error = new Error("Reset link is invalid or expired.");
      (error as Error & { code?: string }).code = "auth/invalid-action-code";
      throw error;
    }
    store.users[userId].password = newPassword;
    delete store.passwordResets[code];
  });
};
