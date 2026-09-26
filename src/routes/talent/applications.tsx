import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { list, mutedButton, timeAgo } from "@/components/site/ui";
import { APPLICATION_STATUS_LABEL } from "@/lib/applications";

export const Route = createFileRoute("/talent/applications")({
  head: () => ({
    meta: [{ title: "Your Applications" }, { name: "robots", content: "noindex" }],
  }),
  component: Applications,
});

type ApplicationRow = {
  id: string;
  status: string;
  created_at: string;
  jobs: {
    title: string;
    company_name: string | null;
    location: string | null;
    type: string | null;
    apply_url: string | null;
  } | null;
};

function Applications() {
  const { userId } = Route.useRouteContext();
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("job_applications")
        .select("id, status, created_at, jobs (title, company_name, location, type, apply_url)")
        .eq("applicant_id", userId)
        .order("created_at", { ascending: false });
      setApplications((data as unknown as ApplicationRow[]) ?? []);
      setLoading(false);
    })();
  }, [userId]);

  async function withdraw(id: string) {
    const { error } = await supabase.from("job_applications").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setApplications((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Your applications</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Roles you've applied to through Savant, and applications you started on a company's own
        site.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : applications.length === 0 ? (
        <div className="mt-10 rounded-sm border border-[color:var(--color-hairline)] p-6">
          <p className="text-sm text-muted-foreground">
            No applications yet.{" "}
            <Link to="/talent/jobs" className="text-foreground underline underline-offset-4">
              Browse your job feed
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className={`mt-8 ${list}`}>
          {applications.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-4 py-6">
              <div className="min-w-0">
                <div className="text-lg font-medium">{a.jobs?.title ?? "Untitled role"}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                  {[a.jobs?.company_name, a.jobs?.location, a.jobs?.type]
                    .filter(Boolean)
                    .join(" · ") || "—"}{" "}
                  · {timeAgo(a.created_at)}
                </div>
              </div>
              <div className="flex items-center gap-5">
                <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {APPLICATION_STATUS_LABEL[a.status] ?? a.status}
                </span>
                {a.status === "started" && a.jobs?.apply_url && (
                  <a
                    href={a.jobs.apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={mutedButton}
                  >
                    Continue ↗
                  </a>
                )}
                {(a.status === "started" || a.status === "submitted") && (
                  <button onClick={() => withdraw(a.id)} className={mutedButton}>
                    Withdraw
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
