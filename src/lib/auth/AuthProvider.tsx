import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadAuthContext, type AuthContext as SessionAuthContext } from "./session";
import { can, type Permission } from "@/lib/authz/permissions";

type AuthState = {
  /** Still resolving the initial session on first mount. */
  loading: boolean;
  auth: SessionAuthContext | null;
  can: (permission: Permission) => boolean;
  signOut: () => Promise<void>;
};

const AuthReactContext = createContext<AuthState>({
  loading: true,
  auth: null,
  can: () => false,
  signOut: async () => {},
});

/**
 * The one place the app subscribes to Supabase auth state. Every component
 * that needs to know who's signed in and what role they hold reads from
 * `useAuth()` instead of calling `supabase.auth.*` itself — that's what
 * keeps role-checking logic from spreading across the codebase.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [auth, setAuth] = useState<SessionAuthContext | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const ctx = await loadAuthContext();
    setAuth(ctx);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        refresh();
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
          router.invalidate();
          if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
        }
      });
      return () => sub.subscription.unsubscribe();
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  }, [refresh, router, queryClient]);

  async function signOut() {
    await supabase.auth.signOut();
    setAuth(null);
  }

  return (
    <AuthReactContext.Provider
      value={{ loading, auth, can: (permission) => can(auth?.role, permission), signOut }}
    >
      {children}
    </AuthReactContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthReactContext);
}
