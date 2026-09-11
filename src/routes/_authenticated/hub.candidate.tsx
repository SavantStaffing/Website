import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/hub/candidate")({
  head: () => ({
    meta: [{ title: "Your applications" }, { name: "robots", content: "noindex" }],
  }),
  component: Candidate,
});

type ApplicationRow = {
  id: string;
  status: string;
  created_at: string;
  jobs: { title: string; location: string | null; type: string | null } | null;
};

function Candidate() {
  const { user } = Route.useRouteContext();
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("job_applications")
        .select("id, status, created_at, jobs (title, location, type)")
        .eq("applicant_id", user.id)
        .order("created_at", { ascending: false });
      setApplications((data as unknown as ApplicationRow[]) ?? []);
      setLoading(false);
    })();
  }, [user.id]);

  return (
    <section>
      <h2 className="text-2xl font-semibold">Your applications</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Roles you've applied to through Savant.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : applications.length === 0 ? (
        <div className="mt-10 rounded-sm border border-[color:var(--color-hairline)] p-6">
          <p className="text-sm text-muted-foreground">
            No applications yet.{" "}
            <Link to="/jobs" className="text-foreground underline underline-offset-4">
              Browse open roles
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
          {applications.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-4 py-6">
              <div>
                <div className="text-lg font-medium">{a.jobs?.title ?? "Untitled role"}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                  {a.jobs?.location ?? "—"} · {a.jobs?.type ?? "—"}
                </div>
              </div>
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {a.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
