import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/talent/jobs")({
  head: () => ({
    meta: [{ title: "Find Jobs" }, { name: "robots", content: "noindex" }],
  }),
  component: FindJobs,
});

type JobRow = {
  id: string;
  title: string;
  location: string | null;
  type: string | null;
};

function FindJobs() {
  const { userId } = Route.useRouteContext();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: jobRows }, { data: appRows }, { data: savedRows }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, title, location, type")
          .order("created_at", { ascending: false }),
        supabase.from("job_applications").select("job_id").eq("applicant_id", userId),
        supabase.from("saved_jobs").select("job_id").eq("user_id", userId),
      ]);
      setJobs((jobRows as JobRow[]) ?? []);
      setApplied(new Set((appRows ?? []).map((r) => r.job_id)));
      setSaved(new Set((savedRows ?? []).map((r) => r.job_id)));
      setLoading(false);
    })();
  }, [userId]);

  async function apply(jobId: string) {
    const { error } = await supabase
      .from("job_applications")
      .insert({ job_id: jobId, applicant_id: userId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Application submitted.");
    setApplied((prev) => new Set(prev).add(jobId));
  }

  async function toggleSave(jobId: string) {
    if (saved.has(jobId)) {
      const { error } = await supabase
        .from("saved_jobs")
        .delete()
        .eq("job_id", jobId)
        .eq("user_id", userId);
      if (error) {
        toast.error(error.message);
        return;
      }
      setSaved((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    } else {
      const { error } = await supabase
        .from("saved_jobs")
        .insert({ job_id: jobId, user_id: userId });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSaved((prev) => new Set(prev).add(jobId));
    }
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Find jobs</h2>
      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : jobs.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No open roles right now.</p>
      ) : (
        <ul className="mt-8 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
          {jobs.map((job) => (
            <li key={job.id} className="flex flex-wrap items-baseline justify-between gap-4 py-6">
              <div>
                <div className="text-lg font-medium">{job.title}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                  {job.location ?? "—"} · {job.type ?? "—"}
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.2em]">
                <button
                  onClick={() => toggleSave(job.id)}
                  className="text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
                >
                  {saved.has(job.id) ? "Saved ✓" : "Save"}
                </button>
                {applied.has(job.id) ? (
                  <span className="text-muted-foreground">Applied</span>
                ) : (
                  <button
                    onClick={() => apply(job.id)}
                    className="[@media(hover:hover)]:hover:text-muted-foreground"
                  >
                    Apply →
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
