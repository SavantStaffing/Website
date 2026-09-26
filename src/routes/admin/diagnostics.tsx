import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge, Empty, SectionHeading, Stat, card, label, timeAgo } from "@/components/site/ui";

export const Route = createFileRoute("/admin/diagnostics")({
  head: () => ({
    meta: [{ title: "Diagnostics" }, { name: "robots", content: "noindex" }],
  }),
  component: Diagnostics,
});

type Metric = {
  run_id: string;
  source: string;
  requests: number;
  successes: number;
  rate_limited: number;
  status_counts: Record<string, number>;
  avg_response_ms: number | null;
  p95_response_ms: number | null;
  proxy: string | null;
  jobs_ingested: number;
  schema_failures: number;
  field_fill_rates: Record<string, number>;
  created_at: string;
};

const RUN_WINDOW = 10;
const FIELDS = [
  "location",
  "description",
  "department",
  "employment_type",
  "posted_at",
  "industry",
  "naics_code",
];

const pct = (n: number) => `${Math.round(n * 100)}%`;
const tone = (rate: number, good = 0.95, warn = 0.8) =>
  rate >= good ? "good" : rate >= warn ? "warn" : "bad";

/**
 * Internal Diagnostics: scraper health (proxy, rate limits, HTTP status,
 * success rate, response time), data (ingested counts, field-level fill
 * rates by source), and schema-validation failures by source — computed from
 * the last few scout runs.
 */
function Diagnostics() {
  const [metrics, setMetrics] = useState<Metric[] | null>(null);
  const [lastRun, setLastRun] = useState<{ id: string; started_at: string; status: string } | null>(
    null,
  );
  const [live, setLive] = useState<Record<string, { active: number; flagged: number }>>({});

  useEffect(() => {
    (async () => {
      const { data: runs } = await supabase
        .from("scout_runs")
        .select("id, started_at, status")
        .neq("status", "running")
        .order("started_at", { ascending: false })
        .limit(RUN_WINDOW);
      setLastRun(runs?.[0] ?? null);
      const ids = (runs ?? []).map((r) => r.id);
      if (!ids.length) return setMetrics([]);
      const { data } = await supabase.from("scout_source_metrics").select("*").in("run_id", ids);
      const rows = (data as unknown as Metric[]) ?? [];
      setMetrics(rows);

      const sources = [
        ...new Set([
          "manual",
          ...rows.map((m) => m.source).filter((s) => s !== "webscan" && s !== "jobspy"),
        ]),
      ];
      const counts = await Promise.all(
        sources.map(async (s) => {
          const [{ count: active }, { count: flagged }] = await Promise.all([
            supabase
              .from("jobs")
              .select("id", { count: "exact", head: true })
              .eq("source", s)
              .eq("status", "active"),
            supabase
              .from("jobs")
              .select("id", { count: "exact", head: true })
              .eq("source", s)
              .eq("status", "flagged"),
          ]);
          return [s, { active: active ?? 0, flagged: flagged ?? 0 }] as const;
        }),
      );
      setLive(Object.fromEntries(counts));
    })();
  }, []);

  const bySource = useMemo(() => {
    if (!metrics) return [];
    const map = new Map<string, Metric[]>();
    for (const m of metrics) map.set(m.source, [...(map.get(m.source) ?? []), m]);
    return [...map.entries()]
      .map(([source, rows]) => {
        const latest =
          rows.find((r) => r.run_id === lastRun?.id) ??
          rows.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        const requests = rows.reduce((a, r) => a + r.requests, 0);
        const successes = rows.reduce((a, r) => a + r.successes, 0);
        const rateLimited = rows.reduce((a, r) => a + r.rate_limited, 0);
        const statuses: Record<string, number> = {};
        for (const r of rows)
          for (const [k, v] of Object.entries(r.status_counts ?? {}))
            statuses[k] = (statuses[k] ?? 0) + v;
        const timed = rows.filter((r) => r.avg_response_ms !== null);
        return {
          source,
          latest,
          requests,
          successRate: requests ? successes / requests : 1,
          rateLimited,
          statuses,
          avgMs: timed.length
            ? Math.round(
                timed.reduce((a, r) => a + r.avg_response_ms! * r.requests, 0) /
                  Math.max(
                    1,
                    timed.reduce((a, r) => a + r.requests, 0),
                  ),
              )
            : null,
          p95Ms: timed.length ? Math.max(...timed.map((r) => r.p95_response_ms ?? 0)) : null,
          schemaFailures: rows.reduce((a, r) => a + r.schema_failures, 0),
          ingested: rows.reduce((a, r) => a + r.jobs_ingested, 0),
          proxy: latest?.proxy ?? null,
        };
      })
      .sort((a, b) => a.source.localeCompare(b.source));
  }, [metrics, lastRun]);

  if (!metrics) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (metrics.length === 0)
    return (
      <section>
        <h2 className="text-2xl font-semibold">Internal diagnostics</h2>
        <Empty>
          No scout runs yet.{" "}
          <Link to="/admin/scout" className="text-foreground underline underline-offset-4">
            Add companies and run a scan
          </Link>{" "}
          to see scraper health here.
        </Empty>
      </section>
    );

  const totalReq = bySource.reduce((a, s) => a + s.requests, 0);
  const totalOk = bySource.reduce((a, s) => a + s.successRate * s.requests, 0);
  const total429 = bySource.reduce((a, s) => a + s.rateLimited, 0);
  const totalSchema = bySource.reduce((a, s) => a + s.schemaFailures, 0);
  const ingestSources = bySource.filter((s) => s.source !== "webscan" && s.source !== "jobspy");

  return (
    <section className="space-y-16">
      <div>
        <h2 className="text-2xl font-semibold">Internal diagnostics</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Across the last {RUN_WINDOW} scout runs. Latest run {timeAgo(lastRun?.started_at)}{" "}
          {lastRun && (
            <Badge
              tone={
                lastRun.status === "succeeded"
                  ? "good"
                  : lastRun.status === "partial"
                    ? "warn"
                    : "bad"
              }
            >
              {lastRun.status}
            </Badge>
          )}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Success rate" value={totalReq ? pct(totalOk / totalReq) : "—"} />
        <Stat label="Requests" value={totalReq} />
        <Stat label="Rate-limited (429)" value={total429} />
        <Stat label="Schema failures" value={totalSchema} />
      </div>

      <div>
        <SectionHeading title="Scrapers" />
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
            <thead>
              <tr className="border-b border-[color:var(--color-hairline)] text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <th className="py-3 font-normal">Source</th>
                <th className="py-3 font-normal">Proxy health</th>
                <th className="py-3 text-right font-normal">Success rate</th>
                <th className="py-3 text-right font-normal">Rate-limit health</th>
                <th className="py-3 font-normal">HTTP status</th>
                <th className="py-3 text-right font-normal">Response time</th>
              </tr>
            </thead>
            <tbody>
              {bySource.map((s) => (
                <tr
                  key={s.source}
                  className="border-b border-[color:var(--color-hairline)] align-top"
                >
                  <td className="py-4 font-medium">{s.source}</td>
                  <td className="py-4">
                    {s.proxy ? (
                      <Badge tone="good">{s.proxy}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Direct (no proxy)</span>
                    )}
                  </td>
                  <td className="py-4 text-right">
                    <Badge tone={tone(s.successRate)}>{pct(s.successRate)}</Badge>
                    <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {s.requests} req
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    <Badge
                      tone={
                        s.rateLimited === 0
                          ? "good"
                          : s.rateLimited / Math.max(1, s.requests) < 0.05
                            ? "warn"
                            : "bad"
                      }
                    >
                      {s.rateLimited === 0 ? "healthy" : `${s.rateLimited} × 429`}
                    </Badge>
                  </td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(s.statuses)
                        .sort()
                        .map(([code, n]) => (
                          <Badge
                            key={code}
                            tone={
                              code.startsWith("2")
                                ? "good"
                                : code === "0" || code.startsWith("5")
                                  ? "bad"
                                  : "warn"
                            }
                          >
                            {code === "0" ? "timeout" : code}: {n}
                          </Badge>
                        ))}
                    </div>
                  </td>
                  <td className="py-4 text-right tabular-nums">
                    {s.avgMs ?? "—"} ms
                    <div className="text-xs text-muted-foreground">p95 {s.p95Ms ?? "—"} ms</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <SectionHeading title="Data" />
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
            <thead>
              <tr className="border-b border-[color:var(--color-hairline)] text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <th className="py-3 font-normal">Source</th>
                <th className="py-3 text-right font-normal">Live</th>
                <th className="py-3 text-right font-normal">Flagged</th>
                <th className="py-3 text-right font-normal">Last ingest</th>
                {FIELDS.map((f) => (
                  <th key={f} className="py-3 text-right font-normal">
                    {f.replace("_", " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {ingestSources.map((s) => (
                <tr key={s.source} className="border-b border-[color:var(--color-hairline)]">
                  <td className="py-3 font-medium">{s.source}</td>
                  <td className="py-3 text-right">{live[s.source]?.active ?? "…"}</td>
                  <td className="py-3 text-right">{live[s.source]?.flagged ?? "…"}</td>
                  <td className="py-3 text-right">{s.latest?.jobs_ingested ?? 0}</td>
                  {FIELDS.map((f) => {
                    const v = s.latest?.field_fill_rates?.[f];
                    return (
                      <td
                        key={f}
                        className={`py-3 text-right ${v === undefined ? "text-muted-foreground" : v < 0.5 ? "text-red-700" : v < 0.9 ? "text-amber-700" : ""}`}
                      >
                        {v === undefined ? "—" : pct(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Field-level fill rates are from each source's most recent ingest. Low industry/NAICS fill
          means the company's config row has no NAICS sector set.
        </p>
      </div>

      <div>
        <SectionHeading title="Schema validation failures" />
        <div className={`mt-6 ${card}`}>
          {ingestSources.every((s) => s.schemaFailures === 0) ? (
            <p className="text-sm text-muted-foreground">
              No postings failed validation in the last {RUN_WINDOW} runs.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {ingestSources
                .filter((s) => s.schemaFailures > 0)
                .map((s) => (
                  <li key={s.source} className="flex justify-between gap-4">
                    <span>{s.source}</span>
                    <span className="tabular-nums">
                      {s.schemaFailures} failed of {s.schemaFailures + s.ingested}
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <p className={`mt-4 ${label}`}>By source · last {RUN_WINDOW} runs</p>
        </div>
      </div>
    </section>
  );
}
