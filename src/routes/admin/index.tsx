import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Admin Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const [counts, setCounts] = useState<{
    talent: number;
    recruiters: number;
    jobs: number;
    organizations: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: roleRows }, { count: jobs }, { count: organizations }] = await Promise.all([
        supabase.from("user_roles").select("role"),
        supabase.from("jobs").select("id", { count: "exact", head: true }),
        supabase.from("organizations").select("id", { count: "exact", head: true }),
      ]);
      const talent = (roleRows ?? []).filter((r) => r.role === "talent").length;
      const recruiters = (roleRows ?? []).filter((r) => r.role === "recruiter").length;
      setCounts({ talent, recruiters, jobs: jobs ?? 0, organizations: organizations ?? 0 });
    })();
  }, []);

  const tiles = [
    { label: "Talent accounts", value: counts?.talent },
    { label: "Recruiter accounts", value: counts?.recruiters },
    { label: "Job postings", value: counts?.jobs },
    { label: "Organizations", value: counts?.organizations },
  ];

  return (
    <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-sm border border-[color:var(--color-hairline)] p-6">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            {t.label}
          </div>
          <div className="mt-3 text-4xl font-semibold">{t.value ?? "…"}</div>
        </div>
      ))}
    </section>
  );
}
