import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Badge,
  ChipGroup,
  Empty,
  SectionHeading,
  Stat,
  linkButton,
  list,
  selectCls,
  timeAgo,
} from "@/components/site/ui";
import { SERVICES, SERVICE_LABEL, SERVICE_STATUS_LABEL, type ServiceId } from "@/lib/services";

export const Route = createFileRoute("/coach/")({
  head: () => ({
    meta: [{ title: "Service Requests" }, { name: "robots", content: "noindex" }],
  }),
  component: ServiceRequests,
});

type Request = {
  id: string;
  talent_id: string;
  service: string;
  program: string | null;
  goals: string;
  availability: string | null;
  contact_method: string;
  phone: string | null;
  status: string;
  assigned_coach_id: string | null;
  created_at: string;
};

type Person = { name: string; email: string | null; phone: string | null };

const STATUSES = ["new", "in_progress", "completed", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

/** Preparation-service sign-ups from talent, for career coaches to pick up and work. */
function ServiceRequests() {
  const { userId } = Route.useRouteContext();
  const [rows, setRows] = useState<Request[] | null>(null);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [statusFilter, setStatusFilter] = useState<Status[]>(["new", "in_progress"]);
  const [serviceFilter, setServiceFilter] = useState<ServiceId[]>([]);
  const [mineOnly, setMineOnly] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("service_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      const reqs = data ?? [];
      setRows(reqs);
      // Talent names/emails + coach names for display.
      const ids = [
        ...new Set(reqs.flatMap((r) => [r.talent_id, r.assigned_coach_id]).filter(Boolean)),
      ] as string[];
      if (!ids.length) return;
      const [{ data: profiles }, { data: tps }] = await Promise.all([
        supabase.from("profiles").select("id, username, email, phone").in("id", ids),
        supabase
          .from("talent_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", ids),
      ]);
      const names = new Map(
        (tps ?? []).map((t) => [t.user_id, [t.first_name, t.last_name].filter(Boolean).join(" ")]),
      );
      setPeople(
        new Map(
          (profiles ?? []).map((p) => [
            p.id,
            {
              name: names.get(p.id) || p.username || p.email || "—",
              email: p.email,
              phone: p.phone,
            },
          ]),
        ),
      );
    })();
  }, []);

  const visible = useMemo(
    () =>
      (rows ?? []).filter(
        (r) =>
          (!statusFilter.length || statusFilter.includes(r.status as Status)) &&
          (!serviceFilter.length || serviceFilter.includes(r.service as ServiceId)) &&
          (!mineOnly || r.assigned_coach_id === userId),
      ),
    [rows, statusFilter, serviceFilter, mineOnly, userId],
  );

  async function update(r: Request, patch: Partial<Pick<Request, "status" | "assigned_coach_id">>) {
    const { error } = await supabase.from("service_requests").update(patch).eq("id", r.id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev?.map((x) => (x.id === r.id ? { ...x, ...patch } : x)) ?? null);
  }

  const count = (s: Status) => rows?.filter((r) => r.status === s).length;

  return (
    <section className="space-y-12">
      <div className="grid gap-6 sm:grid-cols-3">
        <Stat label="New sign-ups" value={count("new")} />
        <Stat label="In progress" value={count("in_progress")} />
        <Stat
          label="Assigned to you"
          value={
            rows?.filter((r) => r.assigned_coach_id === userId && r.status === "in_progress").length
          }
        />
      </div>

      <div>
        <SectionHeading title="Service requests" />
        <div className="mt-6 flex flex-wrap items-center gap-6">
          <ChipGroup
            options={STATUSES.map((s) => ({ value: s, label: SERVICE_STATUS_LABEL[s] }))}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <ChipGroup
            options={SERVICES.map((s) => ({ value: s.id, label: s.title }))}
            value={serviceFilter}
            onChange={setServiceFilter}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-foreground"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
            />
            Mine only
          </label>
        </div>

        {!rows ? (
          <Empty>Loading…</Empty>
        ) : visible.length === 0 ? (
          <Empty>No sign-ups match.</Empty>
        ) : (
          <ul className={`mt-6 ${list}`}>
            {visible.map((r) => {
              const talent = people.get(r.talent_id);
              const coach = r.assigned_coach_id ? people.get(r.assigned_coach_id) : null;
              return (
                <li key={r.id} className="py-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-lg font-medium">{talent?.name ?? "Talent"}</span>
                        <Badge>{SERVICE_LABEL[r.service as ServiceId] ?? r.service}</Badge>
                        {r.program && <Badge>{r.program}</Badge>}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Prefers {r.contact_method}:{" "}
                        {r.contact_method === "phone" ? (r.phone ?? "—") : (talent?.email ?? "—")} ·
                        signed up {timeAgo(r.created_at)}
                        {coach && ` · with ${r.assigned_coach_id === userId ? "you" : coach.name}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {r.status === "new" && (
                        <button
                          onClick={() =>
                            update(r, { status: "in_progress", assigned_coach_id: userId })
                          }
                          className={linkButton}
                        >
                          Take it →
                        </button>
                      )}
                      <select
                        value={r.status}
                        onChange={(e) => update(r, { status: e.target.value })}
                        className={selectCls}
                        aria-label="Status"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {SERVICE_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="mt-3 max-w-3xl whitespace-pre-line text-sm">{r.goals}</p>
                  {r.availability && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Availability: {r.availability}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
