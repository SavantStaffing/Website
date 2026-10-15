import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { personName } from "@/lib/people";
import { Empty, label, list, selectCls, timeAgo } from "@/components/site/ui";
import { intakeSummary, type IntakeRow } from "@/lib/talent/intake";

export const Route = createFileRoute("/admin/intake")({
  head: () => ({
    meta: [{ title: "Talent intake" }, { name: "robots", content: "noindex" }],
  }),
  component: IntakeList,
});

type Row = {
  userId: string;
  name: string;
  email: string | null;
  completedAt: string;
  state: string | null;
  summary: ReturnType<typeof intakeSummary>;
};

/**
 * Every completed talent intake (/talent/intake), newest first. Assigned
 * coaches and recruiters see the same answers on their talent lists.
 */
function IntakeList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [state, setState] = useState("");

  useEffect(() => {
    (async () => {
      const { data: prefs, error } = await supabase
        .from("talent_preferences")
        .select(
          "user_id, remote_ok, intake_industry, intake_industry_other, intake_role, intake_role_other, home_zip, home_state, home_metro, travel_miles, availability, intake_completed_at",
        )
        .not("intake_completed_at", "is", null)
        .order("intake_completed_at", { ascending: false })
        .limit(1000);
      if (error) {
        toast.error(error.message);
        return setRows([]);
      }
      const ids = (prefs ?? []).map((p) => p.user_id);
      const [{ data: profiles }, { data: tps }] = ids.length
        ? await Promise.all([
            supabase.from("profiles").select("id, username, full_name, email").in("id", ids),
            supabase
              .from("talent_profiles")
              .select("user_id, first_name, last_name")
              .in("user_id", ids),
          ])
        : [{ data: [] }, { data: [] }];
      const p = new Map((profiles ?? []).map((x) => [x.id, x]));
      const t = new Map((tps ?? []).map((x) => [x.user_id, x]));
      setRows(
        (prefs ?? []).map((pf) => {
          const pr = p.get(pf.user_id);
          const tp = t.get(pf.user_id);
          return {
            userId: pf.user_id,
            name:
              [tp?.first_name, tp?.last_name].filter(Boolean).join(" ") ||
              pr?.full_name ||
              pr?.username ||
              pr?.email ||
              "Talent",
            email: pr?.email ?? null,
            completedAt: pf.intake_completed_at!,
            state: pf.home_state,
            summary: intakeSummary(pf as IntakeRow),
          };
        }),
      );
    })();
  }, []);

  const states = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.state).filter(Boolean) as string[])].sort(),
    [rows],
  );
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (!state || r.state === state) &&
        (!needle ||
          [r.name, r.email, r.summary.industry, r.summary.role, r.summary.home]
            .join(" ")
            .toLowerCase()
            .includes(needle)),
    );
  }, [rows, q, state]);

  return (
    <div>
      <h2 className="text-2xl font-semibold">Talent intake</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        What each talent told us when they joined: industry, role, where they are, how far they'll
        travel and when they can work. Their job feed refines itself to these answers, and their
        assigned coach or recruiter sees them too.
      </p>

      <div className="mt-8 flex flex-wrap items-end gap-5">
        <label className="block min-w-[16rem] flex-1">
          <span className={label}>Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, industry, role, ZIP"
            className="block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-2 text-base outline-none focus:border-foreground"
          />
        </label>
        <label className="block">
          <span className={label}>State</span>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className={`mt-2 block ${selectCls}`}
          >
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {rows && (
          <span className="pb-2 text-xs text-muted-foreground">
            {shown.length} of {rows.length} intake{rows.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {!rows ? (
        <Empty>Loading…</Empty>
      ) : !shown.length ? (
        <Empty>
          {rows.length ? "No intakes match." : "No talent has completed the intake yet."}
        </Empty>
      ) : (
        <ul className={`mt-6 ${list}`}>
          {shown.map((r) => (
            <li key={r.userId} className="py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <span className="text-lg font-medium">{r.name}</span>
                  {r.email && (
                    <a
                      href={`mailto:${r.email}`}
                      className="ml-3 text-sm text-muted-foreground underline underline-offset-4"
                    >
                      {r.email}
                    </a>
                  )}
                </div>
                <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {timeAgo(r.completedAt)}
                </span>
              </div>
              <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <Item term="Industry">{r.summary.industry || "—"}</Item>
                <Item term="Role">{r.summary.role || "—"}</Item>
                <Item term="Home ZIP">{r.summary.home || "—"}</Item>
                <Item term="Will travel">{r.summary.travel}</Item>
                <Item term="Availability">{r.summary.availability}</Item>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Item({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{term}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
