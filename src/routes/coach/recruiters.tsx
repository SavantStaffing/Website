import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Empty, list, timeAgo } from "@/components/site/ui";

export const Route = createFileRoute("/coach/recruiters")({
  head: () => ({
    meta: [{ title: "Recruiters" }, { name: "robots", content: "noindex" }],
  }),
  component: CoachRecruiters,
});

type Row = {
  id: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  organizations: { name: string } | null;
};

/** Read-only list of recruiter accounts and their companies. */
function CoachRecruiters() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "recruiter");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return setRows([]);
      const { data } = await supabase
        .from("profiles")
        .select("id, username, email, phone, created_at, organizations (name)")
        .in("id", ids)
        .order("created_at", { ascending: false });
      setRows((data as unknown as Row[]) ?? []);
    })();
  }, []);

  return (
    <section>
      <h2 className="text-2xl font-semibold">Recruiters</h2>
      {!rows ? (
        <Empty>Loading…</Empty>
      ) : rows.length === 0 ? (
        <Empty>No recruiter accounts yet.</Empty>
      ) : (
        <ul className={`mt-8 ${list}`}>
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-4 py-4">
              <div>
                <div className="font-medium">{r.username ?? r.email}</div>
                <div className="text-xs text-muted-foreground">
                  {[r.email, r.phone].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="text-right text-sm">
                <div>{r.organizations?.name ?? "No company assigned"}</div>
                <div className="text-xs text-muted-foreground">joined {timeAgo(r.created_at)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
