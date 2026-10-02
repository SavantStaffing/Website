import { createFileRoute } from "@tanstack/react-router";
import { SectionHeading } from "@/components/site/ui";
import { AssignedTalentList } from "@/components/talent/AssignedTalentList";

export const Route = createFileRoute("/recruiter/assigned")({
  head: () => ({
    meta: [{ title: "Assigned Talent" }, { name: "robots", content: "noindex" }],
  }),
  component: AssignedTalent,
});

/** Talent a Savant admin assigned to this recruiter, with full profiles and résumés. */
function AssignedTalent() {
  const { userId } = Route.useRouteContext();
  return (
    <section>
      <SectionHeading title="Assigned talent" />
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        People a Savant admin has matched with you. You can see their full profile, contact details,
        what they're looking for and their résumé. If an assignment ends, they leave this list.
      </p>
      <AssignedTalentList
        staffId={userId}
        emptyText="No talent assigned to you yet. A Savant admin will assign people to you here."
      />
    </section>
  );
}
