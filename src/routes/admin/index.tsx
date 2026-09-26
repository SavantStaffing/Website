import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge, Stat, card, label, linkButton, timeAgo } from "@/components/site/ui";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Admin Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminDashboard,
});

type Counts = {
  talent: number;
  recruiters: number;
  organizations: number;
  activeJobs: number;
  flaggedJobs: number;
  companies: number;
  openMessages: number;
};

function AdminDashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [lastRun, setLastRun] = useState<{
    started_at: string;
    status: string;
    jobs_inserted: number;
    jobs_flagged: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const head = { count: "exact" as const, head: true };
      const [{ data: roleRows }, orgs, active, flagged, companies, messages, { data: runs }] =
        await Promise.all([
          supabase.from("user_roles").select("role"),
          supabase.from("organizations").select("id", head),
          supabase.from("jobs").select("id", head).eq("status", "active"),
          supabase.from("jobs").select("id", head).eq("status", "flagged"),
          supabase.from("scout_companies").select("id", head).eq("enabled", true),
          supabase.from("contact_messages").select("id", head).eq("handled", false),
          supabase
            .from("scout_runs")
            .select("started_at, status, jobs_inserted, jobs_flagged")
            .order("started_at", { ascending: false })
            .limit(1),
        ]);
      setCounts({
        talent: (roleRows ?? []).filter((r) => r.role === "talent").length,
        recruiters: (roleRows ?? []).filter((r) => r.role === "recruiter").length,
        organizations: orgs.count ?? 0,
        activeJobs: active.count ?? 0,
        flaggedJobs: flagged.count ?? 0,
        companies: companies.count ?? 0,
        openMessages: messages.count ?? 0,
      });
      setLastRun(runs?.[0] ?? null);
    })();
  }, []);

  return (
    <section className="space-y-12">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Talent accounts" value={counts?.talent}>
          <Link to="/admin/users" className={`mt-4 inline-block ${linkButton}`}>
            Users →
          </Link>
        </Stat>
        <Stat label="Recruiter accounts" value={counts?.recruiters}>
          <Link to="/admin/recruiters" className={`mt-4 inline-block ${linkButton}`}>
            Assign →
          </Link>
        </Stat>
        <Stat label="Organizations" value={counts?.organizations} />
        <Stat label="Open messages" value={counts?.openMessages}>
          <Link to="/admin/messages" className={`mt-4 inline-block ${linkButton}`}>
            Read →
          </Link>
        </Stat>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Live job postings" value={counts?.activeJobs}>
          <Link to="/admin/jobs" className={`mt-4 inline-block ${linkButton}`}>
            Jobs →
          </Link>
        </Stat>
        <Stat label="Ghost jobs to review" value={counts?.flaggedJobs}>
          <Link to="/admin/scout" className={`mt-4 inline-block ${linkButton}`}>
            Review →
          </Link>
        </Stat>
        <Stat label="Companies scouted" value={counts?.companies}>
          <Link to="/admin/scout" className={`mt-4 inline-block ${linkButton}`}>
            Job Scout →
          </Link>
        </Stat>
        <div className={card}>
          <div className={label}>Last scout run</div>
          {lastRun ? (
            <>
              <div className="mt-3 text-2xl font-semibold">{timeAgo(lastRun.started_at)}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge
                  tone={
                    lastRun.status === "succeeded"
                      ? "good"
                      : lastRun.status === "partial"
                        ? "warn"
                        : "bad"
                  }
                >
                  {lastRun.status}
                </Badge>
                {lastRun.jobs_inserted} new · {lastRun.jobs_flagged} flagged
              </div>
            </>
          ) : (
            <div className="mt-3 text-sm text-muted-foreground">Never run</div>
          )}
          <Link to="/admin/diagnostics" className={`mt-4 inline-block ${linkButton}`}>
            Diagnostics →
          </Link>
        </div>
      </div>
    </section>
  );
}
