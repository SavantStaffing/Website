import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/guards";
import { getDashboardPath } from "@/lib/auth/session";

/**
 * The single place "which dashboard does this role land on" is decided.
 * Every post-login/signup/verification flow redirects here instead of
 * hardcoding a role-specific path.
 */
export const Route = createFileRoute("/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    const ctx = await requireAuth();
    throw redirect({ to: getDashboardPath(ctx.role), replace: true });
  },
});
