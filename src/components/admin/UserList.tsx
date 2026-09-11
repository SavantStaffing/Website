import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { updateUserRole } from "@/lib/authz/server-actions";
import type { AppRole } from "@/lib/auth/session";
import { toast } from "sonner";

type ProfileRow = {
  id: string;
  username: string | null;
  email: string | null;
  organization_id: string | null;
  organizations: { name: string } | null;
};

/**
 * Shared list used by /admin/users, /admin/talent, and /admin/recruiters —
 * the only difference between those pages is which role they filter to and
 * whether role-editing is enabled. Role changes go through the
 * `updateUserRole` server function, which re-checks admin status itself
 * rather than trusting that this component was only rendered for an admin.
 */
export function UserList({
  roleFilter,
  showOrganization = false,
  allowRoleChange = false,
}: {
  roleFilter?: AppRole;
  showOrganization?: boolean;
  allowRoleChange?: boolean;
}) {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<Record<string, AppRole>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    const [{ data: profileRows }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, email, organization_id, organizations (name)")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap: Record<string, AppRole> = {};
    (roleRows ?? []).forEach((r) => {
      roleMap[r.user_id] = r.role;
    });
    setRoles(roleMap);
    setProfiles((profileRows as unknown as ProfileRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(userId: string, role: AppRole) {
    setSavingId(userId);
    try {
      await updateUserRole({ data: { userId, role } });
      toast.success("Role updated.");
      setRoles((prev) => ({ ...prev, [userId]: role }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const filtered = roleFilter ? profiles.filter((p) => roles[p.id] === roleFilter) : profiles;
  if (filtered.length === 0) return <p className="text-sm text-muted-foreground">No users yet.</p>;

  return (
    <ul className="divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
      {filtered.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <div>{p.username ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{p.email}</div>
            {showOrganization && (
              <div className="mt-1 text-xs text-muted-foreground">
                {p.organizations?.name ?? "No organization assigned"}
              </div>
            )}
          </div>
          {allowRoleChange ? (
            <select
              value={roles[p.id] ?? "talent"}
              disabled={savingId === p.id}
              onChange={(e) => changeRole(p.id, e.target.value as AppRole)}
              className="rounded-sm border border-[color:var(--color-hairline)] bg-transparent px-3 py-2 text-[12px] uppercase tracking-[0.15em] disabled:opacity-50"
            >
              <option value="talent">Talent</option>
              <option value="recruiter">Recruiter</option>
              <option value="admin">Admin</option>
            </select>
          ) : (
            <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {roles[p.id] ?? "—"}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
