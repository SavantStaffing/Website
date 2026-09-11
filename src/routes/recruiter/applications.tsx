import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/recruiter/applications")({
  head: () => ({
    meta: [{ title: "Applications" }, { name: "robots", content: "noindex" }],
  }),
  component: RecruiterApplications,
});

const STATUSES = ["submitted", "reviewed", "interviewing", "hired", "rejected"] as const;

type ApplicationRow = {
  id: string;
  status: string;
  job_id: string;
  applicant_id: string;
  jobTitle: string;
  applicantName: string;
};

function RecruiterApplications() {
  const { profile } = Route.useRouteContext();
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile.organizationId) {
      setLoading(false);
      return;
    }
    const { data: orgJobs } = await supabase
      .from("jobs")
      .select("id, title")
      .eq("organization_id", profile.organizationId);
    const jobMap = new Map((orgJobs ?? []).map((j) => [j.id, j.title]));
    const jobIds = [...jobMap.keys()];
    if (jobIds.length === 0) {
      setLoading(false);
      return;
    }

    const { data: apps } = await supabase
      .from("job_applications")
      .select("id, status, job_id, applicant_id")
      .in("job_id", jobIds)
      .order("created_at", { ascending: false });

    const applicantIds = [...new Set((apps ?? []).map((a) => a.applicant_id))];
    const { data: profiles } = applicantIds.length
      ? await supabase.from("profiles").select("id, username, email").in("id", applicantIds)
      : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.username ?? p.email ?? "—"]));

    setApplications(
      (apps ?? []).map((a) => ({
        id: a.id,
        status: a.status,
        job_id: a.job_id,
        applicant_id: a.applicant_id,
        jobTitle: jobMap.get(a.job_id) ?? "Untitled role",
        applicantName: nameMap.get(a.applicant_id) ?? "—",
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [profile.organizationId]);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("job_applications").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  if (!profile.organizationId) {
    return (
      <div className="rounded-sm border border-[color:var(--color-hairline)] p-6">
        <p className="text-sm text-muted-foreground">
          Your account isn't linked to an organization yet, so there are no applications to show.
        </p>
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Applications</h2>
      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : applications.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No applications yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
          {applications.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div>
                <div className="text-lg font-medium">{a.applicantName}</div>
                <div className="mt-1 text-xs text-muted-foreground">{a.jobTitle}</div>
              </div>
              <select
                value={a.status}
                onChange={(e) => updateStatus(a.id, e.target.value)}
                className="rounded-sm border border-[color:var(--color-hairline)] bg-transparent px-3 py-2 text-[12px] uppercase tracking-[0.15em]"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
