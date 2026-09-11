import { createFileRoute } from "@tanstack/react-router";
import { UserList } from "@/components/admin/UserList";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [{ title: "Users" }, { name: "robots", content: "noindex" }],
  }),
  component: Users,
});

function Users() {
  return (
    <section>
      <h2 className="text-2xl font-semibold">All users</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Every account on the platform. Change a role here to promote or demote a user — this goes
        through a server-side check that re-verifies you're an admin before it does anything.
      </p>
      <div className="mt-8">
        <UserList allowRoleChange showOrganization />
      </div>
    </section>
  );
}
