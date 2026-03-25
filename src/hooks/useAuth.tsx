import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isDev: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isDev: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadingTimeout = window.setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 4000);

    const bypass = localStorage.getItem("gevit_admin_bypass");

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      if (bypass) return; // Prevent real session from overriding dev bypass
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      window.clearTimeout(loadingTimeout);
    });

    const initializeSession = async () => {
      if (bypass) {
        const mockUser = {
          id: "00000000-0000-0000-0000-000000000000",
          email: "dev@gevit.local",
          app_metadata: {},
          user_metadata: { nome_completo: "Administrador (Dev)" },
          aud: "authenticated",
          created_at: new Date().toISOString(),
        } as User;
        const mockSession = {
          access_token: "mock-token",
          refresh_token: "mock-refresh",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "bearer",
          user: mockUser,
        } as Session;
        if (isMounted) {
          setUser(mockUser);
          setSession(mockSession);
          setLoading(false);
          window.clearTimeout(loadingTimeout);
        }
        return;
      }

      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!isMounted) return;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch {
        if (!isMounted) return;
        setSession(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
          window.clearTimeout(loadingTimeout);
        }
      }
    };

    void initializeSession();

    return () => {
      isMounted = false;
      window.clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    localStorage.removeItem("gevit_admin_bypass");
    await supabase.auth.signOut();
  };

  const isDev = localStorage.getItem("gevit_admin_bypass") === "true";

  return (
    <AuthContext.Provider value={{ user, session, loading, isDev, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
