import { redirect } from "@tanstack/react-router";
import { loadAuthContext, type AppRole, type AuthContext } from "./session";

/** Any authenticated user — used by route groups that don't need a specific role. */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await loadAuthContext();
  if (!ctx) {
    throw redirect({ to: "/auth", search: { mode: "login" } });
  }
  return ctx;
}

/**
 * Authenticated AND holding exactly this role. Used as the `beforeLoad` for
 * each of the /talent, /recruiter, /admin route groups. A signed-in user
 * with the wrong role is sent to /forbidden rather than silently redirected
 * to their own dashboard, so misdirected links are visible instead of hidden.
 */
export async function requireRole(role: AppRole): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.role !== role) {
    throw redirect({ to: "/forbidden" });
  }
  return ctx;
}
