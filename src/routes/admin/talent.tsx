import { createFileRoute } from "@tanstack/react-router";
import { UserList } from "@/components/admin/UserList";

export const Route = createFileRoute("/admin/talent")({
  head: () => ({
    meta: [{ title: "Talent" }, { name: "robots", content: "noindex" }],
  }),
  component: TalentManagement,
});

function TalentManagement() {
  return (
    <section>
      <h2 className="text-2xl font-semibold">Talent</h2>
      <p className="mt-2 text-sm text-muted-foreground">Accounts registered as job seekers.</p>
      <div className="mt-8">
        <UserList roleFilter="talent" />
      </div>
    </section>
  );
}
