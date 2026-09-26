import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge, Empty, label, list, timeAgo } from "@/components/site/ui";

export const Route = createFileRoute("/coach/talent")({
  head: () => ({
    meta: [{ title: "Talent" }, { name: "robots", content: "noindex" }],
  }),
  component: CoachTalent,
});

type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  headline: string | null;
  location: string | null;
  skills: string[];
};

/** Read-only list of every talent account. */
function CoachTalent() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "talent");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return setRows([]);
      const [{ data: profiles }, { data: tps }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, email, phone, created_at")
          .in("id", ids)
          .order("created_at", { ascending: false }),
        supabase
          .from("talent_profiles")
          .select("user_id, first_name, last_name, headline, location, skills")
          .in("user_id", ids),
      ]);
      const byId = new Map((tps ?? []).map((t) => [t.user_id, t]));
      setRows(
        (profiles ?? []).map((p) => {
          const t = byId.get(p.id);
          return {
            id: p.id,
            name:
              [t?.first_name, t?.last_name].filter(Boolean).join(" ") ||
              p.username ||
              p.email ||
              "—",
            email: p.email,
            phone: p.phone,
            created_at: p.created_at,
            headline: t?.headline ?? null,
            location: t?.location ?? null,
            skills: t?.skills ?? [],
          };
        }),
      );
    })();
  }, []);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows ?? [];
    return (rows ?? []).filter((r) =>
      [r.name, r.email, r.headline, r.location, ...r.skills].join(" ").toLowerCase().includes(term),
    );
  }, [rows, q]);

  return (
    <section>
      <h2 className="text-2xl font-semibold">Talent</h2>
      <label className="mt-6 block max-w-md">
        <span className={label}>Search</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, skill, location…"
          className="mt-2 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-2 text-base outline-none focus:border-foreground"
        />
      </label>
      {!rows ? (
        <Empty>Loading…</Empty>
      ) : visible.length === 0 ? (
        <Empty>No talent found.</Empty>
      ) : (
        <>
          <p className="mt-6 text-xs text-muted-foreground">{visible.length} talent</p>
          <ul className={`mt-3 ${list}`}>
            {visible.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[r.email, r.phone].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    joined {timeAgo(r.created_at)}
                  </span>
                </div>
                {(r.headline || r.location) && (
                  <div className="mt-1 text-sm">
                    {[r.headline, r.location].filter(Boolean).join(" · ")}
                  </div>
                )}
                {r.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.skills.slice(0, 8).map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
