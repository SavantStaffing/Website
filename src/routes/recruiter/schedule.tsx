import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Badge,
  Empty,
  SectionHeading,
  Stat,
  linkButton,
  list,
  timeAgo,
} from "@/components/site/ui";
import {
  ApplicationCard,
  splitUpcoming,
  usePeople,
  type Application,
} from "@/components/schedule/parts";

export const Route = createFileRoute("/recruiter/schedule")({
  head: () => ({
    meta: [{ title: "Talent & Schedule" }, { name: "robots", content: "noindex" }],
  }),
  component: RecruiterSchedule,
});

type Invite = {
  id: string;
  talent_id: string;
  status: string;
  created_at: string;
  jobTitle: string;
};

const INVITE_TONE = { pending: "warn", accepted: "good", declined: "bad" } as const;

/**
 * Talent this recruiter's organization has picked for something: applicants
 * moved to review or interviews (with interview times), and invitations sent.
 */
function RecruiterSchedule() {
  const { userId, profile } = Route.useRouteContext();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [invites, setInvites] = useState<Invite[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sent } = await supabase
        .from("application_requests")
        .select("id, talent_id, status, created_at, job_id")
        .eq("recruiter_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);

      const { data: orgJobs } = profile.organizationId
        ? await supabase
            .from("jobs")
            .select("id, title, company_name")
            .eq("organization_id", profile.organizationId)
        : { data: [] };
      const jobIds = [
        ...new Set([...(orgJobs ?? []).map((j) => j.id), ...(sent ?? []).map((s) => s.job_id)]),
      ];
      const { data: jobs } = jobIds.length
        ? await supabase.from("jobs").select("id, title, company_name").in("id", jobIds)
        : { data: [] };
      const jobMap = new Map((jobs ?? []).map((j) => [j.id, j]));

      setInvites(
        (sent ?? []).map((s) => ({ ...s, jobTitle: jobMap.get(s.job_id)?.title ?? "a role" })),
      );

      const orgJobIds = (orgJobs ?? []).map((j) => j.id);
      const { data: rows } = orgJobIds.length
        ? await supabase
            .from("job_applications")
            .select("id, job_id, applicant_id, status, interview_at, interview_note, created_at")
            .in("job_id", orgJobIds)
            .in("status", ["reviewed", "interviewing", "hired"])
            .order("created_at", { ascending: false })
        : { data: [] };
      setApps(
        (rows ?? []).map((a) => ({
          ...a,
          job_id: a.job_id ?? "",
          jobTitle: jobMap.get(a.job_id ?? "")?.title ?? "Untitled role",
          company: jobMap.get(a.job_id ?? "")?.company_name ?? null,
        })),
      );
    })();
  }, [userId, profile.organizationId]);

  const people = usePeople([
    ...(apps ?? []).map((a) => a.applicant_id),
    ...(invites ?? []).map((i) => i.talent_id),
  ]);
  const patchApp = (id: string) => (patch: Partial<Application>) =>
    setApps((prev) => prev?.map((x) => (x.id === id ? { ...x, ...patch } : x)) ?? null);

  const { upcoming, interviewing, shortlisted, hired } = useMemo(() => {
    const open = (apps ?? []).filter((a) => a.status !== "hired");
    const { upcoming, rest } = splitUpcoming(open, (a) => a.interview_at);
    return {
      upcoming,
      interviewing: rest.filter((a) => a.status === "interviewing"),
      shortlisted: rest.filter((a) => a.status === "reviewed"),
      hired: (apps ?? []).filter((a) => a.status === "hired"),
    };
  }, [apps]);

  const appSection = (title: string, items: Application[], empty: string) => (
    <div>
      <SectionHeading title={title} />
      {!apps ? (
        <Empty>Loading…</Empty>
      ) : items.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <ul className={`mt-6 ${list}`}>
          {items.map((a) => (
            <ApplicationCard key={a.id} a={a} people={people} onChange={patchApp(a.id)} />
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section className="space-y-12">
      <div className="grid gap-6 sm:grid-cols-3">
        <Stat label="Upcoming interviews" value={apps ? upcoming.length : null} />
        <Stat label="Shortlisted" value={apps ? shortlisted.length : null}>
          <Link to="/recruiter/applications" className={`mt-4 inline-block ${linkButton}`}>
            All applications →
          </Link>
        </Stat>
        <Stat
          label="Invitations awaiting reply"
          value={invites ? invites.filter((i) => i.status === "pending").length : null}
        />
      </div>

      {!profile.organizationId && (
        <p className="text-sm text-muted-foreground">
          Your account isn't linked to an organization yet, so there are no applicants to show.
        </p>
      )}

      {appSection("Upcoming interviews", upcoming, "No interviews on the calendar.")}
      {appSection(
        "Interviewing — needs a time",
        interviewing,
        "Move an applicant to Interviewing, or schedule one below.",
      )}
      {appSection("Shortlisted (reviewed)", shortlisted, "No applicants marked Reviewed.")}
      {hired.length > 0 && appSection("Hired", hired, "")}

      <div>
        <SectionHeading title="Invitations you've sent">
          <Link to="/recruiter/talent" className={linkButton}>
            Find talent →
          </Link>
        </SectionHeading>
        {!invites ? (
          <Empty>Loading…</Empty>
        ) : invites.length === 0 ? (
          <Empty>You haven't invited anyone to apply yet.</Empty>
        ) : (
          <ul className={`mt-6 ${list}`}>
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
                <div>
                  <div className="text-lg font-medium">
                    {people.get(i.talent_id)?.name ?? "Talent"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {i.jobTitle} · sent {timeAgo(i.created_at)}
                  </div>
                </div>
                <Badge tone={INVITE_TONE[i.status as keyof typeof INVITE_TONE] ?? "muted"}>
                  {i.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
