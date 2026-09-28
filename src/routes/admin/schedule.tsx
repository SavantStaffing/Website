import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Empty, SectionHeading, Stat, list } from "@/components/site/ui";
import {
  ApplicationCard,
  ServiceRequestCard,
  splitUpcoming,
  usePeople,
  type Application,
  type ServiceRequest,
} from "@/components/schedule/parts";

export const Route = createFileRoute("/admin/schedule")({
  head: () => ({
    meta: [{ title: "Talent & Schedule" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminSchedule,
});

/**
 * Platform-wide view of who's assigned to whom: assign service sign-ups to
 * coaches, and see every coaching session and interview on the calendar.
 */
function AdminSchedule() {
  const { userId } = Route.useRouteContext();
  const [requests, setRequests] = useState<ServiceRequest[] | null>(null);
  const [apps, setApps] = useState<Application[] | null>(null);
  const [coachIds, setCoachIds] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("service_requests")
      .select("*")
      .in("status", ["new", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => setRequests(data ?? []));

    supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "career_coach")
      .then(({ data }) => setCoachIds((data ?? []).map((r) => r.user_id)));

    (async () => {
      const { data: rows } = await supabase
        .from("job_applications")
        .select("id, job_id, applicant_id, status, interview_at, interview_note, created_at")
        .or("status.eq.interviewing,interview_at.not.is.null")
        .order("created_at", { ascending: false })
        .limit(500);
      const jobIds = [...new Set((rows ?? []).map((a) => a.job_id))];
      const { data: jobs } = jobIds.length
        ? await supabase
            .from("jobs")
            .select("id, title, company_name, organization_id")
            .in("id", jobIds)
        : { data: [] };
      const orgIds = [
        ...new Set((jobs ?? []).flatMap((j) => (j.organization_id ? [j.organization_id] : []))),
      ];
      const { data: orgs } = orgIds.length
        ? await supabase.from("organizations").select("id, name").in("id", orgIds)
        : { data: [] };
      const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]));
      const jobMap = new Map((jobs ?? []).map((j) => [j.id, j]));
      setApps(
        (rows ?? []).map((a) => {
          const j = jobMap.get(a.job_id);
          return {
            ...a,
            jobTitle: j?.title ?? "Untitled role",
            company:
              (j?.organization_id && orgName.get(j.organization_id)) || j?.company_name || null,
          };
        }),
      );
    })();
  }, []);

  const people = usePeople([
    ...coachIds,
    ...(requests ?? []).flatMap((r) => [r.talent_id, r.assigned_coach_id]),
    ...(apps ?? []).map((a) => a.applicant_id),
  ]);
  const coaches = coachIds
    .map((id) => ({ id, name: people.get(id)?.name ?? "Coach" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const patchRequest = (id: string) => (patch: Partial<ServiceRequest>) =>
    setRequests((prev) => prev?.map((x) => (x.id === id ? { ...x, ...patch } : x)) ?? null);
  const patchApp = (id: string) => (patch: Partial<Application>) =>
    setApps((prev) => prev?.map((x) => (x.id === id ? { ...x, ...patch } : x)) ?? null);

  const unassigned = useMemo(
    () => (requests ?? []).filter((r) => !r.assigned_coach_id),
    [requests],
  );
  const sessions = useMemo(
    () =>
      splitUpcoming(
        (requests ?? []).filter((r) => r.assigned_coach_id),
        (r) => r.scheduled_at,
      ),
    [requests],
  );
  const interviews = useMemo(() => splitUpcoming(apps ?? [], (a) => a.interview_at), [apps]);

  const requestList = (items: ServiceRequest[], empty: string) =>
    !requests ? (
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
            coaches={coaches}
            onChange={patchRequest(r.id)}
          />
        ))}
      </ul>
    );

  const appList = (items: Application[], empty: string) =>
    !apps ? (
      <Empty>Loading…</Empty>
    ) : items.length === 0 ? (
      <Empty>{empty}</Empty>
    ) : (
      <ul className={`mt-6 ${list}`}>
        {items.map((a) => (
          <ApplicationCard key={a.id} a={a} people={people} onChange={patchApp(a.id)} />
        ))}
      </ul>
    );

  return (
    <section className="space-y-12">
      <div className="grid gap-6 sm:grid-cols-3">
        <Stat label="Waiting for a coach" value={requests ? unassigned.length : null} />
        <Stat label="Upcoming sessions" value={requests ? sessions.upcoming.length : null} />
        <Stat label="Upcoming interviews" value={apps ? interviews.upcoming.length : null} />
      </div>

      <div>
        <SectionHeading title="Service sign-ups — assign a coach" />
        {coachIds.length === 0 && (
          <Empty>No career coaches yet — invite one from Coach invites.</Empty>
        )}
        {requestList(unassigned, "Every open sign-up has a coach.")}
      </div>

      <div>
        <SectionHeading title="Upcoming coaching sessions" />
        {requestList(sessions.upcoming, "No sessions on the calendar.")}
      </div>

      <div>
        <SectionHeading title="Assigned — no session yet" />
        {requestList(
          sessions.rest.filter((r) => !r.scheduled_at),
          "Every assigned sign-up has a session time.",
        )}
      </div>

      <div>
        <SectionHeading title="Upcoming interviews" />
        {appList(interviews.upcoming, "No interviews on the calendar.")}
      </div>

      <div>
        <SectionHeading title="Interviewing — no time set" />
        {appList(
          interviews.rest.filter((a) => !a.interview_at),
          "Every interviewing applicant has a time.",
        )}
      </div>
    </section>
  );
}
