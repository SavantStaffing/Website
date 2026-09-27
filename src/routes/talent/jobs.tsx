import { createFileRoute } from "@tanstack/react-router";
import { JobFeed } from "@/components/jobs/JobFeed";
import { parseTrackSearch } from "@/lib/scout/track";

export const Route = createFileRoute("/talent/jobs")({
  validateSearch: parseTrackSearch,
  head: () => ({
    meta: [{ title: "Job Feed" }, { name: "robots", content: "noindex" }],
  }),
  component: TalentJobFeed,
});

function TalentJobFeed() {
  const { userId } = Route.useRouteContext();
  return (
    <section>
      <h2 className="text-2xl font-semibold">Your job feed</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Roles from Savant recruiters and from company career sites our Job Scout checks every day.
        Postings that look stale or never-filled are screened out automatically.
      </p>
      <div className="mt-8">
        <JobFeed mode="talent" userId={userId} />
      </div>
    </section>
  );
}
