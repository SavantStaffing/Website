import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Empty, SectionHeading, Stat, card, linkButton, list, timeAgo } from "@/components/site/ui";

export const Route = createFileRoute("/recruiter/")({
  head: () => ({
    meta: [{ title: "Company Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: CompanyDashboard,
});

type Listing = {
  id: string;
  title: string;
  location: string | null;
  status: string;
  posted_at: string | null;
  created_at: string;
  applicants: number;
  requested: number;
};

type Hire = { id: string; name: string; jobTitle: string; created_at: string };

/** Company Dashboard: job listings (date posted, # applicants, # requested), hires, bookmarked talent. */
function CompanyDashboard() {
  const { userId, profile } = Route.useRouteContext();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [hires, setHires] = useState<Hire[]>([]);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("saved_talent")
      .select("id", { count: "exact", head: true })
      .eq("recruiter_id", userId)
      .then(({ count }) => setSavedCount(count ?? 0));
  }, [userId]);

  useEffect(() => {
    if (!profile.organizationId) return;
    (async () => {
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, title, location, status, posted_at, created_at")
        .eq("organization_id", profile.organizationId!)
        .order("created_at", { ascending: false });
      const ids = (jobs ?? []).map((j) => j.id);
      const [{ data: apps }, { data: reqs }] = ids.length
        ? await Promise.all([
            supabase
              .from("job_applications")
              .select("id, job_id, applicant_id, status, created_at")
              .in("job_id", ids),
            supabase.from("application_requests").select("job_id").in("job_id", ids),
          ])
        : [{ data: [] }, { data: [] }];

      const count = (rows: { job_id: string }[] | null, id: string) =>
        (rows ?? []).filter((r) => r.job_id === id).length;
      setListings(
        (jobs ?? []).map((j) => ({
          ...j,
          applicants: count(apps, j.id),
          requested: count(reqs, j.id),
        })),
      );

      const hired = (apps ?? []).filter((a) => a.status === "hired");
      if (hired.length) {
        const { data: people } = await supabase
          .from("profiles")
          .select("id, username, email")
          .in(
            "id",
            hired.map((h) => h.applicant_id),
          );
        const names = new Map((people ?? []).map((p) => [p.id, p.username ?? p.email ?? "—"]));
        const titles = new Map((jobs ?? []).map((j) => [j.id, j.title]));
        setHires(
          hired.map((h) => ({
            id: h.id,
            name: names.get(h.applicant_id) ?? "—",
            jobTitle: titles.get(h.job_id) ?? "—",
            created_at: h.created_at,
          })),
        );
      }
    })();
  }, [profile.organizationId]);

  if (!profile.organizationId) {
    return (
      <div className={card}>
        <h2 className="text-lg font-medium">Your account isn't linked to an organization yet</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          An admin needs to assign your account to a company before you can post jobs or view
          candidates. You can still{" "}
          <Link to="/recruiter/talent" className="text-foreground underline underline-offset-4">
            browse the talent feed
          </Link>
          .
        </p>
      </div>
    );
  }

  const open = listings?.filter((l) => l.status === "active") ?? [];
  const applicants = listings?.reduce((a, l) => a + l.applicants, 0);

  return (
    <section className="space-y-14">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open listings" value={listings ? open.length : null}>
          <Link to="/recruiter/jobs" className={`mt-4 inline-block ${linkButton}`}>
            Manage →
          </Link>
        </Stat>
        <Stat label="Applicants" value={applicants}>
          <Link to="/recruiter/applications" className={`mt-4 inline-block ${linkButton}`}>
            Review →
          </Link>
        </Stat>
        <Stat label="Hires" value={listings ? hires.length : null} />
        <Stat label="Bookmarked talent" value={savedCount}>
          <Link to="/recruiter/saved" className={`mt-4 inline-block ${linkButton}`}>
            View →
          </Link>
        </Stat>
      </div>

      <div>
        <SectionHeading title="Job listings" />
        {!listings ? null : listings.length === 0 ? (
          <Empty>
            No listings yet.{" "}
            <Link to="/recruiter/jobs" className="text-foreground underline underline-offset-4">
              Post your first job
            </Link>
            .
          </Empty>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--color-hairline)] text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  <th className="py-3 font-normal">Role</th>
                  <th className="py-3 font-normal">Date posted</th>
                  <th className="py-3 text-right font-normal"># Applicants</th>
                  <th className="py-3 text-right font-normal"># Requested</th>
                  <th className="py-3 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id} className="border-b border-[color:var(--color-hairline)]">
                    <td className="py-4">
                      <div>{l.title}</div>
                      <div className="text-xs text-muted-foreground">{l.location ?? "—"}</div>
                    </td>
                    <td className="py-4">
                      {new Date(l.posted_at ?? l.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 text-right tabular-nums">{l.applicants}</td>
                    <td className="py-4 text-right tabular-nums">{l.requested}</td>
                    <td className="py-4 text-right text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                      {l.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <SectionHeading title="Hires" />
        {hires.length === 0 ? (
          <Empty>Mark an application as hired and it shows up here.</Empty>
        ) : (
          <ul className={`mt-6 ${list}`}>
            {hires.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-4 py-4">
                <div>
                  <div>{h.name}</div>
                  <div className="text-xs text-muted-foreground">{h.jobTitle}</div>
                </div>
                <span className="text-xs text-muted-foreground">{timeAgo(h.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
