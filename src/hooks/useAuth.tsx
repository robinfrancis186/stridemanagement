import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let settled = false;
    const settle = () => {
      if (!settled) {
        settled = true;
        setLoading(false);
      }
    };

    // Immediately clear any corrupt/stale auth data that causes infinite retry loops
    try {
      const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      if (storageKey) {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          // If refresh token is very short or access token is missing, it's stale
          if (!parsed?.access_token || !parsed?.refresh_token || parsed.refresh_token.length < 20) {
            console.warn("Clearing stale auth token from localStorage");
            localStorage.removeItem(storageKey);
          }
        }
      }
    } catch {
      // If parsing fails, clear all sb auth keys
      Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        .forEach(k => localStorage.removeItem(k));
    }

    const timeout = setTimeout(() => {
      console.warn("Auth timeout — forcing loading=false");
      settle();
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          try {
            const { data } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user.id)
              .maybeSingle();
            setRole(data?.role ?? null);
          } catch {
            setRole(null);
          }
        } else {
          setRole(null);
        }
        settle();
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        Promise.resolve(
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .maybeSingle()
        ).then(({ data }) => setRole(data?.role ?? null))
          .catch(() => setRole(null));
      }
      settle();
    }).catch((err: any) => {
      console.warn("getSession failed, clearing stale session:", err);
      supabase.auth.signOut().catch(() => {});
      // Force-clear localStorage to stop retry loops
      Object.keys(localStorage).filter(k => k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k));
      settle();
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
