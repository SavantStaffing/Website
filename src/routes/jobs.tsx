import { createFileRoute, Link } from "@tanstack/react-router";
import { JobFeed } from "@/components/jobs/JobFeed";
import { parseTrackSearch } from "@/lib/scout/track";
import { useAuth } from "@/lib/auth/AuthProvider";

export const Route = createFileRoute("/jobs")({
  validateSearch: parseTrackSearch,
  head: () => ({
    meta: [
      { title: "Jobs — Savant Staffing" },
      { name: "description", content: "Open roles placed by Savant Staffing." },
    ],
  }),
  component: Jobs,
});

function Jobs() {
  const { auth } = useAuth();
  return (
    <div className="mx-auto max-w-5xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Jobs</p>
      <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">Open roles.</h1>
      <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
        A preview of what's open right now — from Savant's clients and from company career pages our
        Job Scout watches daily.
      </p>
      {auth?.role === "talent" && (
        <Link
          to="/talent/jobs"
          className="mt-8 inline-block border-b border-foreground pb-1 text-[12px] uppercase tracking-[0.2em]"
        >
          Go to your personalised feed →
        </Link>
      )}
      <div className="mt-12">
        <JobFeed mode="guest" />
      </div>
    </div>
  );
}
