import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Empty, SectionHeading, Stat, linkButton, list } from "@/components/site/ui";
import {
  ServiceRequestCard,
  splitUpcoming,
  usePeople,
  type ServiceRequest,
} from "@/components/schedule/parts";

export const Route = createFileRoute("/coach/schedule")({
  head: () => ({
    meta: [{ title: "Talent & Schedule" }, { name: "robots", content: "noindex" }],
  }),
  component: CoachSchedule,
});

/** Talent assigned to this coach, and their sessions. */
function CoachSchedule() {
  const { userId } = Route.useRouteContext();
  const [rows, setRows] = useState<ServiceRequest[] | null>(null);

  useEffect(() => {
    supabase
      .from("service_requests")
      .select("*")
      .eq("assigned_coach_id", userId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => setRows(data ?? []));
  }, [userId]);

  const people = usePeople((rows ?? []).map((r) => r.talent_id));
  const patchRow = (id: string) => (patch: Partial<ServiceRequest>) =>
    setRows((prev) => prev?.map((x) => (x.id === id ? { ...x, ...patch } : x)) ?? null);

  const { upcoming, needsTime, past } = useMemo(() => {
    const active = (rows ?? []).filter((r) => r.status !== "completed");
    const { upcoming, rest } = splitUpcoming(active, (r) => r.scheduled_at);
    return {
      upcoming,
      needsTime: rest.filter((r) => !r.scheduled_at),
      past: [
        ...rest.filter((r) => r.scheduled_at),
        ...(rows ?? []).filter((r) => r.status === "completed"),
      ],
    };
  }, [rows]);

  const section = (title: string, items: ServiceRequest[], empty: string) => (
    <div>
      <SectionHeading title={title} />
      {!rows ? (
        <Empty>Loading…</Empty>
      ) : items.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <ul className={`mt-6 ${list}`}>
          {items.map((r) => (
            <ServiceRequestCard
              key={r.id}
              r={r}
              people={people}
              viewerId={userId}
              onChange={patchRow(r.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section className="space-y-12">
      <div className="grid gap-6 sm:grid-cols-3">
        <Stat
          label="Assigned talent"
          value={rows ? new Set(rows.map((r) => r.talent_id)).size : null}
        />
        <Stat label="Upcoming sessions" value={rows ? upcoming.length : null} />
        <Stat label="Need a time" value={rows ? needsTime.length : null}>
          <Link to="/coach" className={`mt-4 inline-block ${linkButton}`}>
            Pick up new sign-ups →
          </Link>
        </Stat>
      </div>
      {section("Upcoming sessions", upcoming, "No sessions on the calendar.")}
      {section("Assigned — needs a time", needsTime, "Everyone assigned to you has a session.")}
      {section("Past & completed", past, "Nothing here yet.")}
    </section>
  );
}
