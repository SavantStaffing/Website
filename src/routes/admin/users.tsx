import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserList } from "@/components/admin/UserList";
import { ChipGroup } from "@/components/site/ui";
import type { AppRole } from "@/lib/auth/session";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [{ title: "Users" }, { name: "robots", content: "noindex" }],
  }),
  component: Users,
});

const CATEGORIES: { value: AppRole; label: string }[] = [
  { value: "talent", label: "Talent" },
  { value: "recruiter", label: "Recruiters" },
  { value: "career_coach", label: "Career Coaches" },
  { value: "admin", label: "Admins" },
];

/** Registered users log, categorized by role, with complete role permissions. */
function Users() {
  const [category, setCategory] = useState<AppRole[]>([]);
  return (
    <section>
      <h2 className="text-2xl font-semibold">Registered users</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Every account on the platform, newest first. Change a role here to promote or demote a user
        — this goes through a server-side check that re-verifies you're an admin before it does
        anything.
      </p>
      <div className="mt-6">
        <ChipGroup
          options={CATEGORIES}
          value={category}
          onChange={(v) => setCategory(v.slice(-1))}
        />
      </div>
      <div className="mt-8">
        <UserList allowRoleChange showOrganization showJoined roleFilter={category[0]} />
      </div>
    </section>
  );
}
