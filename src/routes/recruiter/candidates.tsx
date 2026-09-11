import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/recruiter/candidates")({
  head: () => ({
    meta: [{ title: "Candidates" }, { name: "robots", content: "noindex" }],
  }),
  component: Candidates,
});

type Candidate = {
  id: string;
  username: string | null;
  email: string | null;
  appliedTo: string[];
};

function Candidates() {
  const { profile } = Route.useRouteContext();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile.organizationId) {
      setLoading(false);
      return;
    }
    (async () => {
      // RLS already scopes every one of these reads to the recruiter's own
      // organization — this query can't be tricked into returning another
      // company's applicants by changing anything on the client.
      const { data: orgJobs } = await supabase
        .from("jobs")
        .select("id, title")
        .eq("organization_id", profile.organizationId!);
      const jobMap = new Map((orgJobs ?? []).map((j) => [j.id, j.title]));
      const jobIds = [...jobMap.keys()];
      if (jobIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: applications } = await supabase
        .from("job_applications")
        .select("job_id, applicant_id")
        .in("job_id", jobIds);

      const byApplicant = new Map<string, string[]>();
      (applications ?? []).forEach((a) => {
        const titles = byApplicant.get(a.applicant_id) ?? [];
        titles.push(jobMap.get(a.job_id) ?? "Untitled role");
        byApplicant.set(a.applicant_id, titles);
      });
      const applicantIds = [...byApplicant.keys()];
      if (applicantIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, email")
        .in("id", applicantIds);

      setCandidates(
        (profiles ?? []).map((p) => ({
          id: p.id,
          username: p.username,
          email: p.email,
          appliedTo: byApplicant.get(p.id) ?? [],
        })),
      );
      setLoading(false);
    })();
  }, [profile.organizationId]);

  if (!profile.organizationId) {
    return (
      <div className="rounded-sm border border-[color:var(--color-hairline)] p-6">
        <p className="text-sm text-muted-foreground">
          Your account isn't linked to an organization yet, so there are no candidates to show.
        </p>
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Candidates</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Talent who've applied to your organization's postings.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : candidates.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No applicants yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
          {candidates.map((c) => (
            <li key={c.id} className="py-5">
              <div className="text-lg font-medium">{c.username ?? c.email}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Applied to: {c.appliedTo.join(", ")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
