import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/recruiters")({
  head: () => ({
    meta: [{ title: "Recruiters" }, { name: "robots", content: "noindex" }],
  }),
  component: RecruiterManagement,
});

type RecruiterRow = {
  id: string;
  username: string | null;
  email: string | null;
  organization_id: string | null;
  org_permission: string;
};
type OrgRow = { id: string; name: string };

function RecruiterManagement() {
  const [recruiters, setRecruiters] = useState<RecruiterRow[]>([]);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: roleRows }, { data: orgRows }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("organizations").select("id, name").order("name"),
      ]);
      const recruiterIds = (roleRows ?? [])
        .filter((r) => r.role === "recruiter")
        .map((r) => r.user_id);
      setOrgs((orgRows as OrgRow[]) ?? []);

      if (recruiterIds.length === 0) {
        setLoading(false);
        return;
      }
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, username, email, organization_id, org_permission")
        .in("id", recruiterIds);
      setRecruiters((profileRows as RecruiterRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  async function assignOrg(userId: string, organizationId: string) {
    setSavingId(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ organization_id: organizationId || null })
      .eq("id", userId);
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRecruiters((prev) =>
      prev.map((r) => (r.id === userId ? { ...r, organization_id: organizationId || null } : r)),
    );
    toast.success("Organization assigned.");
  }

  async function setPermission(userId: string, permission: string) {
    setSavingId(userId);
    const { error } = await supabase.rpc("set_org_permission", {
      _target: userId,
      _permission: permission,
    });
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRecruiters((prev) =>
      prev.map((r) => (r.id === userId ? { ...r, org_permission: permission } : r)),
    );
    toast.success("Permission updated.");
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Recruiters</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Assign each recruiter to an organization — this is what scopes their job postings and
        candidate visibility to their own company. Make one person per company the owner; they can
        then manage their own team's access.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : recruiters.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No recruiter accounts yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
          {recruiters.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <div>{r.username ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{r.email}</div>
              </div>
              <div className="flex flex-wrap gap-3">
                <select
                  value={r.org_permission}
                  disabled={savingId === r.id || !r.organization_id}
                  onChange={(e) => setPermission(r.id, e.target.value)}
                  className="rounded-sm border border-[color:var(--color-hairline)] bg-transparent px-3 py-2 text-[12px] uppercase tracking-[0.15em] disabled:opacity-50"
                >
                  <option value="owner">Owner</option>
                  <option value="manager">Manager</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <select
                  value={r.organization_id ?? ""}
                  disabled={savingId === r.id}
                  onChange={(e) => assignOrg(r.id, e.target.value)}
                  className="rounded-sm border border-[color:var(--color-hairline)] bg-transparent px-3 py-2 text-[12px] uppercase tracking-[0.15em] disabled:opacity-50"
                >
                  <option value="">No organization</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
