import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type AuthContext = {
  userId: string;
  email: string | null;
  role: AppRole;
  /** What to call the user: full name from their talent profile, else username, else email. */
  displayName: string;
  profile: {
    username: string | null;
    organizationId: string | null;
  };
};

/**
 * Single source of truth for "who is signed in, and what's their role."
 * Used by route guards (beforeLoad), the client AuthProvider, and the
 * post-login redirect — so role-fetching logic exists in exactly one place.
 *
 * A user can hold at most one meaningful role here: admin takes precedence
 * over recruiter over talent if somehow more than one row exists. Returns
 * null for anyone not signed in (or if Supabase isn't connected yet).
 */
export async function loadAuthContext(): Promise<AuthContext | null> {
  try {
    const { data: userRes, error } = await supabase.auth.getUser();
    if (error || !userRes.user) return null;

    const [{ data: roleRows }, { data: profileRow }, { data: talentRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userRes.user.id),
      supabase
        .from("profiles")
        .select("username, organization_id")
        .eq("id", userRes.user.id)
        .maybeSingle(),
      // Only job seekers have one; everyone else gets no row back.
      supabase
        .from("talent_profiles")
        .select("first_name, last_name")
        .eq("user_id", userRes.user.id)
        .maybeSingle(),
    ]);
    const fullName = [talentRow?.first_name, talentRow?.last_name]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(" ");

    const roles = (roleRows ?? []).map((r) => r.role);
    const role: AppRole = roles.includes("admin")
      ? "admin"
      : roles.includes("recruiter")
        ? "recruiter"
        : roles.includes("career_coach")
          ? "career_coach"
          : "talent";

    return {
      userId: userRes.user.id,
      email: userRes.user.email ?? null,
      role,
      displayName: fullName || profileRow?.username?.trim() || userRes.user.email || "Your account",
      profile: {
        username: profileRow?.username ?? null,
        organizationId: profileRow?.organization_id ?? null,
      },
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export function getDashboardPath(role: AppRole): string {
  if (role === "admin") return "/admin";
  if (role === "recruiter") return "/recruiter";
  if (role === "career_coach") return "/coach";
  return "/talent";
}
