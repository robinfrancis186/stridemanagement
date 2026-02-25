import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { clearCorruptAuthTokenKeys, clearSupabaseStorageKeys } from "@/lib/authStorage";

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
    let unmounted = false;

    const settle = () => {
      if (!settled && !unmounted) {
        settled = true;
        setLoading(false);
      }
    };

    const loadRole = async (userId: string) => {
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();

        if (!unmounted) {
          setRole(data?.role ?? null);
        }
      } catch {
        if (!unmounted) {
          setRole(null);
        }
      }
    };

    const syncSession = async (nextSession: Session | null) => {
      if (unmounted) return;

      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        await loadRole(nextUser.id);
      } else {
        setRole(null);
      }

      settle();
    };

    const recoverAuthState = async (error: unknown) => {
      console.warn("Auth recovery triggered:", error);
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      clearSupabaseStorageKeys();

      if (!unmounted) {
        setSession(null);
        setUser(null);
        setRole(null);
      }

      settle();
    };

    clearCorruptAuthTokenKeys();

    const timeout = setTimeout(() => {
      console.warn("Auth timeout — forcing loading=false");
      settle();
    }, 4000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
    });

    void (async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;
        await syncSession(session);
      } catch (error) {
        await recoverAuthState(error);
      }
    })();

    return () => {
      unmounted = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearSupabaseStorageKeys();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

