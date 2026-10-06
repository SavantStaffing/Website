import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MyServiceRequests } from "@/components/preparation/MyServiceRequests";
import { TALENT_STATUS_LABEL } from "@/lib/applications";
import {
  Badge,
  Empty,
  SectionHeading,
  Stat,
  card,
  linkButton,
  list,
  mutedButton,
  timeAgo,
} from "@/components/site/ui";

export const Route = createFileRoute("/talent/")({
  head: () => ({
    meta: [{ title: "Talent Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: TalentDashboard,
});

type JobLite = {
  id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  apply_url: string | null;
};
type SavedJobRow = { id: string; job_id: string; jobs: JobLite | null };
type SharedJobRow = {
  id: string;
  shared_by_name: string;
  note: string | null;
  created_at: string;
  jobs: JobLite | null;
};
type ApplicationRow = {
  id: string;
  status: string;
  created_at: string;
  external_title: string | null;
  external_company: string | null;
  jobs: JobLite | null;
};
type RequestRow = {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
  jobs: JobLite | null;
};

function TalentDashboard() {
  const { userId } = Route.useRouteContext();
  const [applications, setApplications] = useState<ApplicationRow[] | null>(null);
  const [saved, setSaved] = useState<SavedJobRow[] | null>(null);
  const [shared, setShared] = useState<SharedJobRow[] | null>(null);
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [profileDone, setProfileDone] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const job = "jobs (id, title, company_name, location, apply_url)";
      const [
        { data: apps },
        { data: savedRows },
        { data: reqs },
        { data: tp },
        { data: sharedRows },
      ] = await Promise.all([
        supabase
          .from("job_applications")
          .select(`id, status, created_at, external_title, external_company, ${job}`)
          .eq("applicant_id", userId)
          .is("archived_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("saved_jobs")
          .select(`id, job_id, ${job}`)
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("application_requests")
          .select(`id, status, message, created_at, ${job}`)
          .eq("talent_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("talent_profiles")
          .select("first_name, resume_text")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("shared_jobs")
          .select(`id, shared_by_name, note, created_at, ${job}`)
          .eq("talent_id", userId)
          .order("created_at", { ascending: false }),
      ]);
      setApplications((apps as unknown as ApplicationRow[]) ?? []);
      setSaved((savedRows as unknown as SavedJobRow[]) ?? []);
      setRequests((reqs as unknown as RequestRow[]) ?? []);
      setProfileDone(!!tp?.first_name && !!tp?.resume_text);
      setShared((sharedRows as unknown as SharedJobRow[]) ?? []);
    })();
  }, [userId]);

  async function respond(id: string, status: "accepted" | "declined") {
    const { error } = await supabase.from("application_requests").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setRequests((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null);
    toast.success(
      status === "accepted" ? "Accepted — your application has been sent." : "Declined.",
    );
  }

  async function removeShared(id: string) {
    const { error } = await supabase.from("shared_jobs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setShared((prev) => prev?.filter((s) => s.id !== id) ?? null);
  }

  async function unsave(row: SavedJobRow) {
    const { error } = await supabase.from("saved_jobs").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    setSaved((prev) => prev?.filter((s) => s.id !== row.id) ?? null);
  }

  const pending = requests?.filter((r) => r.status === "pending") ?? [];

  return (
    <section className="space-y-14">
      {profileDone === false && (
        <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
          <div>
            <div className="text-lg font-medium">Finish your profile</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Recruiters find you through it, and Savant uses it to autofill applications for you.
            </p>
          </div>
          <Link to="/talent/profile" className={linkButton}>
            Complete profile →
          </Link>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-3">
        <Stat label="Applications" value={applications?.length}>
          <Link to="/talent/applications" className={`mt-4 inline-block ${linkButton}`}>
            View all →
          </Link>
        </Stat>
        <Stat label="Bookmarked jobs" value={saved?.length}>
          <Link to="/talent/jobs" className={`mt-4 inline-block ${linkButton}`}>
            Job feed →
          </Link>
        </Stat>
        <Stat label="Invitations waiting" value={requests ? pending.length : null} />
      </div>

      <div>
        <SectionHeading title="Invitations from recruiters" />
        {!requests ? null : requests.length === 0 ? (
          <Empty>No invitations yet. Keeping your profile visible to recruiters helps.</Empty>
        ) : (
          <ul className={`mt-6 ${list}`}>
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-4 py-5">
                <div className="min-w-0">
                  <div className="text-lg font-medium">{r.jobs?.title ?? "A role"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {r.jobs?.company_name ?? "Savant client"} · {r.jobs?.location ?? "—"} ·{" "}
                    {timeAgo(r.created_at)}
                  </div>
                  {r.message && (
                    <p className="mt-2 max-w-2xl whitespace-pre-line text-sm">{r.message}</p>
                  )}
                </div>
                {r.status === "pending" ? (
                  <div className="flex gap-5">
                    <button onClick={() => respond(r.id, "accepted")} className={linkButton}>
                      Accept & apply
                    </button>
                    <button onClick={() => respond(r.id, "declined")} className={mutedButton}>
                      Decline
                    </button>
                  </div>
                ) : (
                  <Badge tone={r.status === "accepted" ? "good" : "muted"}>{r.status}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {shared && shared.length > 0 && (
        <div>
          <SectionHeading title="Shared with you" />
          <ul className={`mt-6 ${list}`}>
            {shared.map((s) => (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-4 py-5">
                <div className="min-w-0">
                  <div className="text-lg font-medium">{s.jobs?.title ?? "A role"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {s.jobs?.company_name ?? "—"} · {s.jobs?.location ?? "—"} · from{" "}
                    {s.shared_by_name} · {timeAgo(s.created_at)}
                  </div>
                  {s.note && <p className="mt-2 max-w-2xl whitespace-pre-line text-sm">{s.note}</p>}
                </div>
                <div className="flex shrink-0 gap-5">
                  {s.jobs?.apply_url ? (
                    <a
                      href={s.jobs.apply_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkButton}
                    >
                      Open ↗
                    </a>
                  ) : (
                    <Link to="/talent/jobs" className={linkButton}>
                      Job feed →
                    </Link>
                  )}
                  <button onClick={() => removeShared(s.id)} className={mutedButton}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MyServiceRequests userId={userId} />

      <div className="grid gap-14 lg:grid-cols-2">
        <div>
          <SectionHeading title="Applications" />
          {!applications ? null : applications.length === 0 ? (
            <Empty>
              Nothing yet.{" "}
              <Link to="/talent/jobs" className="text-foreground underline underline-offset-4">
                Browse your feed
              </Link>
              .
            </Empty>
          ) : (
            <ul className={`mt-6 ${list}`}>
              {applications.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <div className="truncate">
                      {a.jobs?.title ?? a.external_title ?? "Untitled role"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.jobs?.company_name ?? a.external_company ?? "—"}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {TALENT_STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <SectionHeading title="Bookmarked jobs" />
          {!saved ? null : saved.length === 0 ? (
            <Empty>Bookmark roles from your feed to come back to them.</Empty>
          ) : (
            <ul className={`mt-6 ${list}`}>
              {saved.map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <div className="truncate">{s.jobs?.title ?? "Untitled role"}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.jobs?.company_name ?? "—"} · {s.jobs?.location ?? "—"}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-4">
                    {s.jobs?.apply_url && (
                      <a
                        href={s.jobs.apply_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkButton}
                      >
                        Open ↗
                      </a>
                    )}
                    <button onClick={() => unsave(s)} className={mutedButton}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
