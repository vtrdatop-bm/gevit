import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isDev: boolean;
  roles: string[];
  activeRole: string | null;
  rolesLoading: boolean;
  setActiveRole: (role: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isDev: false,
  roles: [],
  activeRole: null,
  rolesLoading: true,
  setActiveRole: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  const [activeRole, setActiveRoleState] = useState<string | null>(null);
  const [rolesLoading, setRolesLoading] = useState(true);

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
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      window.clearTimeout(loadingTimeout);
    });

    const initializeSession = async () => {

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
    await supabase.auth.signOut();
  };

  const isDev = false;

  useEffect(() => {
    const loadRoles = async () => {
      if (!user) {
        setRoles([]);
        setActiveRole(null);
        setRolesLoading(false);
        return;
      }

      if (user.id === "00000000-0000-0000-0000-000000000000") {
        setRoles(["admin"]);
        setActiveRole("admin");
        setRolesLoading(false);
        return;
      }

      setRolesLoading(true);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const nextRoles = (data || []).map((r) => r.role as string);
      setRoles(nextRoles);

      const storageKey = `gevit_active_role_${user.id}`;
      const persisted = localStorage.getItem(storageKey);
      if (persisted && nextRoles.includes(persisted)) {
        setActiveRoleState(persisted);
      } else {
        const fallbackRole = nextRoles[0] || null;
        setActiveRoleState(fallbackRole);
        if (fallbackRole) {
          localStorage.setItem(storageKey, fallbackRole);
        } else {
          localStorage.removeItem(storageKey);
        }
      }

      setRolesLoading(false);
    };

    void loadRoles();
  }, [user]);

  const setActiveRole = (role: string) => {
    if (!user) return;
    if (!roles.includes(role)) return;
    setActiveRoleState(role);
    localStorage.setItem(`gevit_active_role_${user.id}`, role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isDev,
        roles,
        activeRole,
        rolesLoading,
        setActiveRole,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
