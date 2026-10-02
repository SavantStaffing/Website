import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Badge,
  Empty,
  SectionHeading,
  Stat,
  card,
  label,
  linkButton,
  list,
  mutedButton,
  primaryButton,
  selectCls,
  timeAgo,
} from "@/components/site/ui";

export const Route = createFileRoute("/admin/assignments")({
  head: () => ({
    meta: [{ title: "Talent assignments" }, { name: "robots", content: "noindex" }],
  }),
  component: Assignments,
});

type Assignment = {
  id: string;
  talent_id: string;
  staff_id: string;
  staff_role: string;
  status: string;
  note: string | null;
  created_at: string;
  decided_at: string | null;
};
type Person = { id: string; name: string; email: string | null; detail: string | null };
type Staff = Person & { role: "recruiter" | "career_coach" };

const ROLE_LABEL: Record<string, string> = { recruiter: "Recruiter", career_coach: "Coach" };

/**
 * The assignment pipeline. Admins assign talent to recruiters and coaches
 * and decide coaches' "request to coach" asks. An active assignment gives
 * that recruiter or coach the talent's full profile, contact details, job
 * preferences and résumé (public.is_assigned); ending it takes access away.
 * Coaching sign-ups are assigned to coaches on Talent & Schedule.
 */
function Assignments() {
  const { userId } = Route.useRouteContext();
  const [rows, setRows] = useState<Assignment[] | null>(null);
  const [talent, setTalent] = useState<Map<string, Person>>(new Map());
  const [staff, setStaff] = useState<Map<string, Staff>>(new Map());
  const [talentId, setTalentId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [note, setNote] = useState("");
  const [talentQuery, setTalentQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: a, error }, { data: roles }] = await Promise.all([
        supabase.from("talent_assignments").select("*").order("created_at", { ascending: false }),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["talent", "recruiter", "career_coach"]),
      ]);
      if (error) {
        toast.error(error.message);
        return setRows([]);
      }
      const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
      const [{ data: profiles }, { data: tps }, { data: orgs }] = await Promise.all([
        ids.length
          ? supabase.from("profiles").select("id, username, email, organization_id").in("id", ids)
          : Promise.resolve({ data: [] as never[] }),
        ids.length
          ? supabase
              .from("talent_profiles")
              .select("user_id, first_name, last_name, headline, current_title")
              .in("user_id", ids)
          : Promise.resolve({ data: [] as never[] }),
        supabase.from("organizations").select("id, name"),
      ]);
      const tp = new Map((tps ?? []).map((t) => [t.user_id, t]));
      const org = new Map((orgs ?? []).map((o) => [o.id, o.name]));
      const prof = new Map((profiles ?? []).map((p) => [p.id, p]));
      const t = new Map<string, Person>();
      const s = new Map<string, Staff>();
      for (const r of roles ?? []) {
        const p = prof.get(r.user_id);
        if (r.role === "talent") {
          const x = tp.get(r.user_id);
          t.set(r.user_id, {
            id: r.user_id,
            name:
              [x?.first_name, x?.last_name].filter(Boolean).join(" ") ||
              p?.username ||
              p?.email ||
              "Talent",
            email: p?.email ?? null,
            detail: x?.headline || x?.current_title || null,
          });
        } else {
          s.set(r.user_id, {
            id: r.user_id,
            role: r.role as Staff["role"],
            name: p?.username || p?.email || ROLE_LABEL[r.role],
            email: p?.email ?? null,
            detail: p?.organization_id ? (org.get(p.organization_id) ?? null) : null,
          });
        }
      }
      setTalent(t);
      setStaff(s);
      setRows((a as Assignment[]) ?? []);
    })();
  }, []);

  const pending = useMemo(() => (rows ?? []).filter((r) => r.status === "requested"), [rows]);
  const active = useMemo(() => (rows ?? []).filter((r) => r.status === "active"), [rows]);
  const talentOptions = useMemo(() => {
    const term = talentQuery.trim().toLowerCase();
    return [...talent.values()]
      .filter(
        (p) => !term || `${p.name} ${p.email ?? ""} ${p.detail ?? ""}`.toLowerCase().includes(term),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [talent, talentQuery]);
  const staffOptions = useMemo(
    () =>
      [...staff.values()].sort(
        (a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name),
      ),
    [staff],
  );

  function patchRow(id: string, patch: Partial<Assignment>) {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? null);
  }

  async function decide(r: Assignment, status: "active" | "declined" | "ended") {
    const { error } = await supabase.from("talent_assignments").update({ status }).eq("id", r.id);
    if (error) return toast.error(error.message);
    patchRow(r.id, { status, decided_at: new Date().toISOString() });
    toast.success(
      status === "active"
        ? "Approved. The coach can now see their full profile."
        : status === "declined"
          ? "Request declined."
          : "Assignment ended. Their access is removed.",
    );
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    const s = staff.get(staffId);
    if (!talentId || !s) return toast.error("Choose a talent and a recruiter or coach.");
    setSaving(true);
    // One row per talent and staff member: reassigning revives an ended one.
    const { data, error } = await supabase
      .from("talent_assignments")
      .upsert(
        {
          talent_id: talentId,
          staff_id: s.id,
          staff_role: s.role,
          status: "active",
          note: note.trim() || null,
          requested_by: userId,
        },
        { onConflict: "talent_id,staff_id" },
      )
      .select("*")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    setRows((prev) => [data as Assignment, ...(prev ?? []).filter((r) => r.id !== data.id)]);
    setNote("");
    toast.success(`${talent.get(talentId)?.name ?? "Talent"} assigned to ${s.name}.`);
  }

  const name = (m: Map<string, Person>, id: string) => m.get(id)?.name ?? "Unknown";

  return (
    <section className="space-y-16">
      <div>
        <h2 className="text-2xl font-semibold">Talent assignments</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Assign talent to a recruiter or coach. While an assignment is active, that person can see
          the talent's full profile, contact details, job preferences and résumé. Coaching sign-ups
          are assigned on{" "}
          <Link to="/admin/schedule" className="underline underline-offset-4">
            Talent &amp; Schedule
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Stat label="Requests to coach" value={rows ? pending.length : undefined} />
        <Stat label="Active assignments" value={rows ? active.length : undefined} />
        <Stat label="Talent accounts" value={rows ? talent.size : undefined} />
      </div>

      <div>
        <SectionHeading title="Requests to coach" />
        {!rows ? (
          <Empty>Loading…</Empty>
        ) : pending.length === 0 ? (
          <Empty>No coach requests waiting.</Empty>
        ) : (
          <ul className={`mt-6 ${list}`}>
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <div className="font-medium">
                    {name(staff, r.staff_id)}{" "}
                    <span className="text-muted-foreground">wants to coach</span>{" "}
                    {name(talent, r.talent_id)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {talent.get(r.talent_id)?.detail ?? "No headline"} · asked{" "}
                    {timeAgo(r.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <button onClick={() => decide(r, "active")} className={linkButton}>
                    Approve
                  </button>
                  <button onClick={() => decide(r, "declined")} className={mutedButton}>
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <SectionHeading title="Assign talent" />
        <form onSubmit={assign} className={`mt-6 grid max-w-3xl gap-6 ${card}`}>
          <div className="grid gap-6 md:grid-cols-2">
            <label className="grid gap-2">
              <span className={label}>Talent</span>
              <input
                value={talentQuery}
                onChange={(e) => setTalentQuery(e.target.value)}
                placeholder="Search by name, email or headline"
                className="border-b border-[color:var(--color-hairline)] bg-transparent py-1.5 text-sm outline-none focus:border-foreground"
                aria-label="Search talent"
              />
              <select
                id="assign-talent"
                value={talentId}
                onChange={(e) => setTalentId(e.target.value)}
                className={selectCls}
                required
              >
                <option value="">Choose talent ({talentOptions.length})</option>
                {talentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.detail ? ` — ${p.detail}` : p.email ? ` — ${p.email}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid content-start gap-2">
              <span className={label}>Recruiter or coach</span>
              <select
                id="assign-staff"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className={selectCls}
                required
              >
                <option value="">Choose a person</option>
                {(["recruiter", "career_coach"] as const).map((role) => (
                  <optgroup key={role} label={`${ROLE_LABEL[role]}s`}>
                    {staffOptions
                      .filter((s) => s.role === role)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.detail ? ` — ${s.detail}` : ""}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {staff.size === 0 && (
                <span className="text-xs text-muted-foreground">
                  No recruiter or coach accounts yet.
                </span>
              )}
            </label>
          </div>
          <label className="grid gap-2">
            <span className={label}>Note for them (optional)</span>
            <textarea
              id="assign-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Why this match, what to focus on…"
              className="rounded-sm border border-[color:var(--color-hairline)] bg-transparent p-3 text-sm outline-none focus:border-foreground"
            />
          </label>
          <div>
            <button type="submit" disabled={saving} className={primaryButton}>
              {saving ? "Assigning…" : "Assign"}
            </button>
          </div>
        </form>
      </div>

      <div>
        <SectionHeading title="Active assignments" />
        {!rows ? (
          <Empty>Loading…</Empty>
        ) : active.length === 0 ? (
          <Empty>No active assignments.</Empty>
        ) : (
          <ul className={`mt-6 ${list}`}>
            {active.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium">{name(talent, r.talent_id)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{name(staff, r.staff_id)}</span>
                    <Badge>{ROLE_LABEL[r.staff_role] ?? r.staff_role}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    since {timeAgo(r.decided_at ?? r.created_at)}
                    {r.note ? ` · ${r.note}` : ""}
                  </div>
                </div>
                <button onClick={() => decide(r, "ended")} className={mutedButton}>
                  End
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
