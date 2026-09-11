import type { AppRole } from "@/lib/auth/session";

/**
 * The full permission vocabulary for the app. Adding a new capability means
 * adding one entry here and listing which roles get it below — never a new
 * `if (role === "...")` scattered in a component.
 *
 * IMPORTANT: this is a UI-presentation convenience only. It decides what a
 * component renders (a button, a nav link, a form). It enforces nothing —
 * the actual authorization boundary is the Supabase RLS policies in
 * supabase/migrations/. A permission listed here that isn't backed by a
 * matching RLS policy is a UI-only hint with no security value; keep the
 * two in sync deliberately.
 */
export type Permission =
  | "job:view_public"
  | "job:create"
  | "job:manage_org"
  | "job:manage_all"
  | "application:create"
  | "application:view_own"
  | "application:view_org"
  | "application:view_all"
  | "application:update_status"
  | "candidate:view_org_applicants"
  | "candidate:view_all"
  | "profile:manage_own"
  | "organization:view_own"
  | "organization:manage_all"
  | "user:manage"
  | "role:manage"
  | "platform:administer";

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  talent: ["job:view_public", "application:create", "application:view_own", "profile:manage_own"],
  recruiter: [
    "job:view_public",
    "job:create",
    "job:manage_org",
    "application:view_org",
    "application:update_status",
    "candidate:view_org_applicants",
    "profile:manage_own",
    "organization:view_own",
  ],
  admin: [
    "job:view_public",
    "job:create",
    "job:manage_org",
    "job:manage_all",
    "application:view_all",
    "application:update_status",
    "candidate:view_all",
    "profile:manage_own",
    "organization:view_own",
    "organization:manage_all",
    "user:manage",
    "role:manage",
    "platform:administer",
  ],
};

export function can(role: AppRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
