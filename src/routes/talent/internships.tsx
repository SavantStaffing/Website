import { createFileRoute, Link } from "@tanstack/react-router";
import { JobFeed } from "@/components/jobs/JobFeed";

export const Route = createFileRoute("/talent/internships")({
  head: () => ({ meta: [{ title: "Internships | Savant" }, { name: "robots", content: "noindex" }] }),
  component: InternshipFeed,
});
function InternshipFeed() {
  const { userId } = Route.useRouteContext();
  return <section>
    <Link to="/talent/jobs" className="text-sm underline underline-offset-4">← All jobs</Link>
    <h2 className="mt-5 text-2xl font-semibold">Internship feed</h2>
    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
      Internship opportunities from the existing Job Scout and verified listings.
      Save a role or start an application just as you would in your regular feed.
    </p>
    <div className="mt-8"><JobFeed mode="talent" userId={userId}
      initialTrack="professional" initialEmploymentTypes={["internship"]} /></div>
  </section>;
}
