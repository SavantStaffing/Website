import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/recruiter/")({
  head: () => ({
    meta: [{ title: "Recruiter Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: RecruiterDashboard,
});

function RecruiterDashboard() {
  const { profile } = Route.useRouteContext();
  const [jobCount, setJobCount] = useState<number | null>(null);
  const [applicationCount, setApplicationCount] = useState<number | null>(null);

  useEffect(() => {
    if (!profile.organizationId) return;
    (async () => {
      const { count: jobs } = await supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organizationId!);

      const { data: orgJobs } = await supabase
        .from("jobs")
        .select("id")
        .eq("organization_id", profile.organizationId!);
      const jobIds = (orgJobs ?? []).map((j) => j.id);

      let applications = 0;
      if (jobIds.length > 0) {
        const { count } = await supabase
          .from("job_applications")
          .select("id", { count: "exact", head: true })
          .in("job_id", jobIds);
        applications = count ?? 0;
      }

      setJobCount(jobs ?? 0);
      setApplicationCount(applications);
    })();
  }, [profile.organizationId]);

  if (!profile.organizationId) {
    return (
      <div className="rounded-sm border border-[color:var(--color-hairline)] p-6">
        <h2 className="text-lg font-medium">Your account isn't linked to an organization yet</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          An admin needs to assign your account to a company before you can post jobs or view
          candidates. Contact your Savant admin.
        </p>
      </div>
    );
  }

  return (
    <section className="grid gap-6 sm:grid-cols-2">
      <div className="rounded-sm border border-[color:var(--color-hairline)] p-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          Open postings
        </div>
        <div className="mt-3 text-4xl font-semibold">{jobCount ?? "…"}</div>
        <Link
          to="/recruiter/jobs"
          className="mt-4 inline-block text-[11px] uppercase tracking-[0.2em] [@media(hover:hover)]:hover:text-muted-foreground"
        >
          Manage jobs →
        </Link>
      </div>
      <div className="rounded-sm border border-[color:var(--color-hairline)] p-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          Applications received
        </div>
        <div className="mt-3 text-4xl font-semibold">{applicationCount ?? "…"}</div>
        <Link
          to="/recruiter/applications"
          className="mt-4 inline-block text-[11px] uppercase tracking-[0.2em] [@media(hover:hover)]:hover:text-muted-foreground"
        >
          Review applications →
        </Link>
      </div>
    </section>
  );
}
