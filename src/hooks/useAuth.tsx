import { createContext, useContext, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: null;
  loading: boolean;
  role: string | null;
  signOut: () => Promise<void>;
}

const DEMO_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "demo@stride-coe.com",
  app_metadata: {},
  user_metadata: { full_name: "Demo User" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as unknown as User;

const AuthContext = createContext<AuthContextType>({
  user: DEMO_USER,
  session: null,
  loading: false,
  role: "coe_admin",
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  return (
    <AuthContext.Provider
      value={{
        user: DEMO_USER,
        session: null,
        loading: false,
        role: "coe_admin",
        signOut: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
