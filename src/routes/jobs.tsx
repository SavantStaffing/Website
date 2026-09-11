import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthProvider";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Jobs — Savant Staffing" },
      { name: "description", content: "Open roles placed by Savant Staffing." },
    ],
  }),
  component: Jobs,
});

const PLACEHOLDER = [
  { id: "placeholder-1", title: "Role title", location: "Location", type: "Full-time" },
  { id: "placeholder-2", title: "Role title", location: "Location", type: "Contract" },
  { id: "placeholder-3", title: "Role title", location: "Location", type: "Temporary" },
] as const;

type JobRow = {
  id: string;
  title: string;
  location: string | null;
  type: string | null;
};

function Jobs() {
  const { auth, can } = useAuth();
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("jobs")
          .select("id, title, location, type")
          .order("created_at", { ascending: false });
        if (error || !data || data.length === 0) return;
        setJobs(data as JobRow[]);
      } catch (error) {
        console.error(error);
      }
    })();
  }, []);

  useEffect(() => {
    if (!auth) return;
    supabase
      .from("job_applications")
      .select("job_id")
      .eq("applicant_id", auth.userId)
      .then(({ data }) => setApplied(new Set((data ?? []).map((r) => r.job_id))));
  }, [auth]);

  async function apply(jobId: string) {
    if (!auth) return;
    const { error } = await supabase
      .from("job_applications")
      .insert({ job_id: jobId, applicant_id: auth.userId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Application submitted.");
    setApplied((prev) => new Set(prev).add(jobId));
  }

  const listings = jobs ?? PLACEHOLDER;
  const isLive = jobs !== null;
  const canApply = can("application:create");

  return (
    <div className="mx-auto max-w-5xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Jobs</p>
      <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">Open roles.</h1>
      <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
        {isLive
          ? "Current openings placed by Savant."
          : "Listings coming soon — placeholder roles shown below."}
      </p>

      <ul className="mt-16 border-t border-[color:var(--color-hairline)]">
        {listings.map((job) => (
          <li
            key={job.id}
            className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[color:var(--color-hairline)] py-8"
          >
            <div>
              <div className="text-2xl font-medium">{job.title}</div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                {job.location ?? "Location"} · {job.type ?? "Type"}
              </div>
            </div>
            {!isLive ? (
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Coming soon
              </span>
            ) : applied.has(job.id) ? (
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Applied
              </span>
            ) : canApply ? (
              <button
                onClick={() => apply(job.id)}
                className="text-[11px] uppercase tracking-[0.2em] [@media(hover:hover)]:hover:text-muted-foreground"
              >
                Apply →
              </button>
            ) : auth ? null : (
              <Link
                to="/auth"
                search={{ mode: "login", next: "/jobs" } as never}
                className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
              >
                Sign in to apply
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
