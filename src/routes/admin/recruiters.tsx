import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { linkButton, mutedButton, timeAgo } from "@/components/site/ui";

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
type RequestRow = {
  user_id: string;
  company_name: string | null;
  status: string;
  requested_at: string;
  username: string | null;
  email: string | null;
};

function RecruiterManagement() {
  const [recruiters, setRecruiters] = useState<RecruiterRow[]>([]);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [deciding, setDeciding] = useState<string | null>(null);

  async function loadRequests() {
    const { data: rows } = await supabase
      .from("recruiter_requests")
      .select("user_id, company_name, status, requested_at")
      .in("status", ["pending", "declined"])
      .order("requested_at", { ascending: true });
    const ids = (rows ?? []).map((r) => r.user_id);
    const { data: people } = ids.length
      ? await supabase.from("profiles").select("id, username, email").in("id", ids)
      : { data: [] };
    const byId = new Map((people ?? []).map((p) => [p.id, p]));
    setRequests(
      (rows ?? []).map((r) => ({
        ...r,
        username: byId.get(r.user_id)?.username ?? null,
        email: byId.get(r.user_id)?.email ?? null,
      })),
    );
  }

  async function decide(r: RequestRow, approve: boolean) {
    if (!approve && !window.confirm(`Decline ${r.username ?? r.email ?? "this recruiter"}?`))
      return;
    setDeciding(r.user_id);
    const { error } = await supabase.rpc("decide_recruiter_request", {
      _user_id: r.user_id,
      _approve: approve,
    });
    setDeciding(null);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Approved. They're now a recruiter." : "Declined.");
    if (approve) {
      setRequests((prev) => prev.filter((x) => x.user_id !== r.user_id));
      setRecruiters((prev) => [
        ...prev,
        {
          id: r.user_id,
          username: r.username,
          email: r.email,
          organization_id: null,
          org_permission: "member",
        },
      ]);
    } else {
      setRequests((prev) =>
        prev.map((x) => (x.user_id === r.user_id ? { ...x, status: "declined" } : x)),
      );
    }
  }

  useEffect(() => {
    void loadRequests();
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

  const pending = requests.filter((r) => r.status === "pending");
  const declined = requests.filter((r) => r.status === "declined");

  return (
    <section>
      <div className="mb-14">
        <h2 className="text-2xl font-semibold">
          Waiting for approval
          {pending.length > 0 && (
            <span className="ml-3 text-sm font-normal text-muted-foreground">{pending.length}</span>
          )}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          New recruiter sign-ups can't see talent or post jobs until you approve them. Once
          approved, assign them to an organization below.
        </p>
        {pending.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No one is waiting.</p>
        ) : (
          <ul className="mt-6 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
            {pending.map((r) => (
              <li
                key={r.user_id}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div>
                  <div>{r.username ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {[r.email, r.company_name, `signed up ${timeAgo(r.requested_at)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="flex gap-5">
                  <button
                    onClick={() => decide(r, true)}
                    disabled={deciding === r.user_id}
                    className={linkButton}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decide(r, false)}
                    disabled={deciding === r.user_id}
                    className={mutedButton}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {declined.length > 0 && (
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Declined ({declined.length})
            </summary>
            <ul className="mt-3 divide-y divide-[color:var(--color-hairline)]">
              {declined.map((r) => (
                <li
                  key={r.user_id}
                  className="flex flex-wrap items-center justify-between gap-4 py-3"
                >
                  <span>
                    {r.username ?? "—"}{" "}
                    <span className="text-xs text-muted-foreground">
                      {[r.email, r.company_name].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <button
                    onClick={() => decide(r, true)}
                    disabled={deciding === r.user_id}
                    className={mutedButton}
                  >
                    Approve after all
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

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
