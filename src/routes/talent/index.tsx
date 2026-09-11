import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/talent/")({
  head: () => ({
    meta: [{ title: "Talent Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: TalentDashboard,
});

type SavedJobRow = {
  id: string;
  jobs: { id: string; title: string; location: string | null } | null;
};

function TalentDashboard() {
  const { userId } = Route.useRouteContext();
  const [applicationCount, setApplicationCount] = useState<number | null>(null);
  const [saved, setSaved] = useState<SavedJobRow[]>([]);

  useEffect(() => {
    (async () => {
      const [{ count }, { data: savedRows }] = await Promise.all([
        supabase
          .from("job_applications")
          .select("id", { count: "exact", head: true })
          .eq("applicant_id", userId),
        supabase
          .from("saved_jobs")
          .select("id, jobs (id, title, location)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      setApplicationCount(count ?? 0);
      setSaved((savedRows as unknown as SavedJobRow[]) ?? []);
    })();
  }, [userId]);

  return (
    <section className="space-y-12">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-sm border border-[color:var(--color-hairline)] p-6">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Applications submitted
          </div>
          <div className="mt-3 text-4xl font-semibold">{applicationCount ?? "…"}</div>
          <Link
            to="/talent/applications"
            className="mt-4 inline-block text-[11px] uppercase tracking-[0.2em] [@media(hover:hover)]:hover:text-muted-foreground"
          >
            View applications →
          </Link>
        </div>
        <div className="rounded-sm border border-[color:var(--color-hairline)] p-6">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Find your next role
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Browse open roles placed by Savant.</p>
          <Link
            to="/talent/jobs"
            className="mt-4 inline-block text-[11px] uppercase tracking-[0.2em] [@media(hover:hover)]:hover:text-muted-foreground"
          >
            Find jobs →
          </Link>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold">Saved jobs</h2>
        {saved.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing saved yet.{" "}
            <Link to="/talent/jobs" className="text-foreground underline underline-offset-4">
              Browse open roles
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
            {saved.map((s) => (
              <li key={s.id} className="py-4">
                <div>{s.jobs?.title ?? "Untitled role"}</div>
                <div className="text-xs text-muted-foreground">{s.jobs?.location ?? "—"}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
