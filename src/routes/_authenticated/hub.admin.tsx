import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/hub/admin")({
  beforeLoad: ({ context }) => {
    if (context.role !== "admin") {
      throw redirect({ to: "/hub" });
    }
  },
  head: () => ({
    meta: [{ title: "Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: Admin,
});

type UserRow = {
  id: string;
  email: string | null;
  username: string | null;
};
type RoleRow = { user_id: string; role: string };
type JobRow = { id: string; title: string; location: string | null };

function Admin() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [jobs, setJobs] = useState<JobRow[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: roleRows }, { data: jobRows }] = await Promise.all([
        supabase.from("profiles").select("id, email, username").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("jobs").select("id, title, location").order("created_at", { ascending: false }),
      ]);
      setUsers((profiles as UserRow[]) ?? []);
      const roleMap: Record<string, string> = {};
      ((roleRows as RoleRow[]) ?? []).forEach((r) => {
        roleMap[r.user_id] = r.role;
      });
      setRoles(roleMap);
      setJobs((jobRows as JobRow[]) ?? []);
    })();
  }, []);

  return (
    <section className="space-y-12">
      <div>
        <h2 className="text-2xl font-semibold">Users</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Everyone with an account, and their assigned role.
        </p>
        <ul className="mt-8 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-baseline justify-between gap-4 py-4">
              <div>
                <div>{u.username ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </div>
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {roles[u.id] ?? "—"}
              </span>
            </li>
          ))}
          {users.length === 0 && (
            <li className="py-4 text-sm text-muted-foreground">No users yet.</li>
          )}
        </ul>
      </div>

      <div>
        <h2 className="text-2xl font-semibold">All job postings</h2>
        <ul className="mt-8 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
          {jobs.map((j) => (
            <li key={j.id} className="py-4">
              <div>{j.title}</div>
              <div className="text-xs text-muted-foreground">{j.location ?? "—"}</div>
            </li>
          ))}
          {jobs.length === 0 && (
            <li className="py-4 text-sm text-muted-foreground">No postings yet.</li>
          )}
        </ul>
      </div>
    </section>
  );
}
