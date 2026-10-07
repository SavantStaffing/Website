import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Badge,
  Empty,
  SectionHeading,
  Stat,
  card,
  label,
  mutedButton,
  timeAgo,
} from "@/components/site/ui";

/** Shape returned by public.admin_scout_diagnostics (admins only). */
type Run = {
  id: string;
  trigger: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_s: number;
  stalled: boolean;
  companies_scanned: number;
  jobs_found: number;
  jobs_inserted: number;
  jobs_updated: number;
  jobs_rejected: number;
  jobs_flagged: number;
  jobs_closed: number;
  error: string | null;
};
type Source = {
  source: string;
  runs: number;
  requests: number;
  successes: number;
  ingested: number;
  schema_failures: number;
  avg_ms: number | null;
  p95_ms: number | null;
  status_counts: Record<string, number>;
  fill_rates: Record<string, number>;
  live_jobs: number;
  flagged_jobs: number;
  last_seen: string;
};
type CronStart = { status: string; start_time: string; end_time: string | null; message: string };
type Company = {
  id: string;
  name: string;
  ats: string | null;
  enabled: boolean;
  last_status: string | null;
  last_error: string | null;
  last_scanned_at: string | null;
};
type Report = {
  window_hours: number;
  generated_at: string;
  runs: Run[];
  sources: Source[];
  cron: CronStart[];
  cron_schedule: string | null;
  dispatch: Record<string, number>;
  companies: Company[];
};

const WINDOWS = [
  { hours: 24, label: "24 hours" },
  { hours: 24 * 7, label: "7 days" },
  { hours: 24 * 30, label: "30 days" },
] as const;

/** The scheduler starts one scan every 15 minutes (supabase/migrations/…_schedule_job_scout.sql). */
const SCAN_INTERVAL_MIN = 15;

const SOURCE_LABEL: Record<string, string> = {
  workday: "Workday",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
  icims: "iCIMS",
  jsonld: "Careers-site markup",
  webscan: "Careers-site discovery",
  avionte: "Avionte (Staffing Network)",
  smpl: "Smpl (Renoir)",
  partners: "Partners Personnel board",
  jobspy: "Job boards (JobSpy)",
  linkedin: "LinkedIn",
  indeed: "Indeed",
  dol: "Dept. of Labor API",
  wikirate: "Wikirate (WBA scores)",
};
const sourceName = (s: string) => SOURCE_LABEL[s] ?? s;

const FIELDS = [
  "location",
  "description",
  "department",
  "employment_type",
  "posted_at",
  "industry",
  "naics_code",
];

const pct = (n: number) => (n > 0 && n < 0.005 ? "<1%" : `${Math.round(n * 100)}%`);
const secs = (s: number | null | undefined) =>
  s === null || s === undefined ? "—" : s < 90 ? `${Math.round(s)}s` : `${(s / 60).toFixed(1)}m`;
const runTone = (status: string) =>
  status === "succeeded" ? "good" : status === "partial" || status === "running" ? "warn" : "bad";

/** Buckets HTTP outcomes the way the scout experiences them. */
function outcomes(codes: Record<string, number>) {
  const o = {
    ok: 0,
    refused: 0,
    rateLimited: 0,
    timedOut: 0,
    serverError: 0,
    notFound: 0,
    other: 0,
  };
  for (const [code, n] of Object.entries(codes)) {
    if (code.startsWith("2")) o.ok += n;
    else if (code === "401" || code === "403") o.refused += n;
    else if (code === "429") o.rateLimited += n;
    else if (code === "0") o.timedOut += n;
    else if (code.startsWith("5")) o.serverError += n;
    else if (code === "404" || code === "410") o.notFound += n;
    else o.other += n;
  }
  return o;
}

const percentile = (values: number[], p: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

/**
 * Internal diagnostics for the Job Scout: run times, the pg_cron schedule,
 * blockage by source (refused, rate limited, timed out), each company's last
 * scan, and data quality. Everything comes from one admin-only RPC,
 * admin_scout_diagnostics, over the selected window.
 */
export function ScoutDiagnostics() {
  const [hours, setHours] = useState<number>(24);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAllRuns, setShowAllRuns] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_scout_diagnostics", { p_hours: hours });
    setLoading(false);
    if (error) return setError(error.message);
    setError(null);
    setReport(data as unknown as Report);
  }, [hours]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    if (!report) return null;
    const finished = report.runs.filter((r) => r.status !== "running");
    const durations = finished.map((r) => r.duration_s);
    const requests = report.sources.reduce((a, s) => a + s.requests, 0);
    const blocked = report.sources.reduce((a, s) => {
      const o = outcomes(s.status_counts);
      return a + o.refused + o.rateLimited + o.timedOut;
    }, 0);
    const lastStart = report.cron[0]?.start_time ?? null;
    const minutesSinceStart = lastStart ? (Date.now() - Date.parse(lastStart)) / 60000 : null;
    const expectedStarts = Math.floor((report.window_hours * 60) / SCAN_INTERVAL_MIN);
    return {
      runs: report.runs.length,
      succeeded: finished.filter((r) => r.status === "succeeded").length,
      failed: finished.filter((r) => r.status === "failed").length,
      partial: finished.filter((r) => r.status === "partial").length,
      stalled: report.runs.filter((r) => r.stalled),
      avg: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
      p95: percentile(durations, 0.95),
      longest: durations.length ? Math.max(...durations) : null,
      requests,
      blocked,
      lastStart,
      schedulerLate: minutesSinceStart !== null && minutesSinceStart > SCAN_INTERVAL_MIN * 2,
      cronFailed: report.cron.filter((c) => c.status !== "succeeded"),
      expectedStarts,
      maxDuration: Math.max(1, ...report.runs.map((r) => r.duration_s)),
    };
  }, [report]);

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Diagnostics</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Job Scout health: run times, the schedule, and what's blocking the scanners.
          {report && <> Updated {timeAgo(report.generated_at)}.</>}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {WINDOWS.map((w) => (
          <button
            key={w.hours}
            type="button"
            onClick={() => setHours(w.hours)}
            aria-pressed={hours === w.hours}
            className={`rounded-sm border px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] ${
              hours === w.hours
                ? "border-foreground bg-foreground text-background"
                : "border-[color:var(--color-hairline)] text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
            }`}
          >
            {w.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={`ml-2 ${mutedButton}`}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </div>
  );

  if (error)
    return (
      <section className="space-y-6">
        {header}
        <p className="text-sm text-red-700">Couldn't load diagnostics: {error}</p>
      </section>
    );
  if (!report || !summary)
    return (
      <section className="space-y-6">
        {header}
        <p className="text-sm text-muted-foreground">Loading…</p>
      </section>
    );

  const runs = showAllRuns ? report.runs : report.runs.slice(0, 25);
  const blockedRate = summary.requests ? summary.blocked / summary.requests : 0;
  const cycleMin =
    Math.max(1, report.companies.filter((c) => c.enabled).length) * SCAN_INTERVAL_MIN;
  const ingestSources = report.sources.filter(
    (s) => !["webscan", "jobspy", "dol", "wikirate"].includes(s.source),
  );

  return (
    <section className="space-y-16">
      {header}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Runs" value={summary.runs}>
          <p className="mt-2 text-xs text-muted-foreground">
            {summary.succeeded} succeeded · {summary.partial} partial · {summary.failed} failed
          </p>
        </Stat>
        <Stat label="Average run time" value={secs(summary.avg)}>
          <p className="mt-2 text-xs text-muted-foreground">
            p95 {secs(summary.p95)} · longest {secs(summary.longest)}
          </p>
        </Stat>
        <Stat label="Stalled runs" value={summary.stalled.length}>
          <p className="mt-2 text-xs text-muted-foreground">
            Still “running” after 10 minutes — stopped by the scanner's time limit
          </p>
        </Stat>
        <Stat label="Blocked requests" value={pct(blockedRate)}>
          <p className="mt-2 text-xs text-muted-foreground">
            {summary.blocked} of {summary.requests} refused, rate-limited or timed out
          </p>
        </Stat>
        <Stat label="Scheduler" value={summary.schedulerLate ? "Late" : "On time"}>
          <p className="mt-2 text-xs text-muted-foreground">
            Last start {timeAgo(summary.lastStart)} · {report.cron.length} of ~
            {summary.expectedStarts} expected starts
          </p>
        </Stat>
        <Stat label="Companies" value={report.companies.filter((c) => c.enabled).length}>
          <p className="mt-2 text-xs text-muted-foreground">
            Each is rescanned about every {secs(cycleMin * 60)}
          </p>
        </Stat>
      </div>

      {/* Run time ------------------------------------------------------ */}
      <div>
        <SectionHeading title="Runs">
          <span className={label}>Newest first · bar = run time</span>
        </SectionHeading>
        {report.runs.length === 0 ? (
          <Empty>No scout runs in this window.</Empty>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
              <thead>
                <tr className="border-b border-[color:var(--color-hairline)] text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  <th className="py-3 font-normal">Started</th>
                  <th className="py-3 font-normal">Trigger</th>
                  <th className="w-48 py-3 font-normal">Run time</th>
                  <th className="py-3 text-right font-normal">Found</th>
                  <th className="py-3 text-right font-normal">New</th>
                  <th className="py-3 text-right font-normal">Updated</th>
                  <th className="py-3 text-right font-normal">Closed</th>
                  <th className="py-3 text-right font-normal">Rejected</th>
                  <th className="py-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[color:var(--color-hairline)] align-top"
                  >
                    <td className="py-3" title={new Date(r.started_at).toLocaleString()}>
                      {timeAgo(r.started_at)}
                    </td>
                    <td className="py-3 text-muted-foreground">{r.trigger}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-[color:var(--color-hairline)]">
                          <div
                            className={`h-1.5 rounded-full ${
                              r.stalled || r.status === "failed"
                                ? "bg-red-600"
                                : r.status === "succeeded"
                                  ? "bg-emerald-600"
                                  : "bg-amber-500"
                            }`}
                            style={{
                              width: `${Math.max(3, (r.duration_s / summary.maxDuration) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="w-12 text-right">{secs(r.duration_s)}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right">{r.jobs_found}</td>
                    <td className="py-3 text-right">{r.jobs_inserted}</td>
                    <td className="py-3 text-right">{r.jobs_updated}</td>
                    <td className="py-3 text-right">{r.jobs_closed}</td>
                    <td className="py-3 text-right">{r.jobs_rejected}</td>
                    <td className="py-3">
                      <Badge tone={r.stalled ? "bad" : runTone(r.status)}>
                        {r.stalled ? "stalled" : r.status}
                      </Badge>
                      {r.error && (
                        <div className="mt-1 max-w-xs text-xs text-red-700">{r.error}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.runs.length > 25 && (
              <button
                type="button"
                onClick={() => setShowAllRuns((v) => !v)}
                className={`mt-4 ${mutedButton}`}
              >
                {showAllRuns ? "Show fewer" : `Show all ${report.runs.length} runs`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scheduler ----------------------------------------------------- */}
      <div>
        <SectionHeading title="Scheduler" />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className={card}>
            <div className={label}>pg_cron job “savant-job-scout”</div>
            <dl className="mt-4 space-y-2 text-sm">
              <Row term="Schedule">
                {report.cron_schedule === "*/15 * * * *"
                  ? "Every 15 minutes"
                  : (report.cron_schedule ?? "Not scheduled")}
              </Row>
              <Row term="Last start">
                {summary.lastStart ? new Date(summary.lastStart).toLocaleString() : "—"}{" "}
                {summary.schedulerLate && <Badge tone="bad">late</Badge>}
              </Row>
              <Row term="Starts in window">
                {report.cron.length} of ~{summary.expectedStarts} expected
              </Row>
              <Row term="Failed starts">
                {summary.cronFailed.length === 0 ? (
                  <Badge tone="good">none</Badge>
                ) : (
                  <Badge tone="bad">{summary.cronFailed.length}</Badge>
                )}
              </Row>
            </dl>
            {summary.cronFailed.slice(0, 3).map((c) => (
              <p key={c.start_time} className="mt-3 text-xs text-red-700">
                {timeAgo(c.start_time)}: {c.message}
              </p>
            ))}
          </div>
          <div className={card}>
            <div className={label}>Calls to the job-scout function</div>
            {Object.keys(report.dispatch).length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No calls recorded in this window.
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(report.dispatch)
                  .sort()
                  .map(([k, n]) => (
                    <Badge key={k} tone={k === "202" || k === "200" ? "good" : "bad"}>
                      {k === "202" ? "accepted" : k}: {n}
                    </Badge>
                  ))}
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              202 means the function accepted the call and started a scan in the background. A 401
              means the scout token didn't match; timeouts mean the function didn't answer. Supabase
              keeps these results for about six hours.
            </p>
          </div>
        </div>
      </div>

      {/* Blockage ------------------------------------------------------ */}
      <div>
        <SectionHeading title="Blockage by source" />
        {report.sources.length === 0 ? (
          <Empty>No requests recorded in this window.</Empty>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[60rem] text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
              <thead>
                <tr className="border-b border-[color:var(--color-hairline)] text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  <th className="py-3 font-normal">Source</th>
                  <th className="py-3 text-right font-normal">Requests</th>
                  <th className="py-3 text-right font-normal">OK</th>
                  <th className="py-3 text-right font-normal">Refused</th>
                  <th className="py-3 text-right font-normal">Rate-limited</th>
                  <th className="py-3 text-right font-normal">Timed out</th>
                  <th className="py-3 text-right font-normal">Server errors</th>
                  <th className="py-3 text-right font-normal">Not found</th>
                  <th className="py-3 text-right font-normal">Blocked</th>
                  <th className="py-3 text-right font-normal">Response</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {report.sources.map((s) => {
                  const o = outcomes(s.status_counts);
                  const blocked = o.refused + o.rateLimited + o.timedOut;
                  const rate = s.requests ? blocked / s.requests : 0;
                  const cell = (n: number, bad = true) => (
                    <td
                      className={`py-3 text-right ${n > 0 && bad ? "text-red-700" : n === 0 ? "text-muted-foreground" : ""}`}
                    >
                      {n}
                    </td>
                  );
                  return (
                    <tr key={s.source} className="border-b border-[color:var(--color-hairline)]">
                      <td className="py-3">
                        <div className="font-medium">{sourceName(s.source)}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.runs} run{s.runs === 1 ? "" : "s"} · last {timeAgo(s.last_seen)}
                        </div>
                      </td>
                      <td className="py-3 text-right">{s.requests}</td>
                      {cell(o.ok, false)}
                      {cell(o.refused)}
                      {cell(o.rateLimited)}
                      {cell(o.timedOut)}
                      {cell(o.serverError)}
                      {cell(o.notFound, false)}
                      <td className="py-3 text-right">
                        <Badge tone={rate === 0 ? "good" : rate < 0.05 ? "warn" : "bad"}>
                          {pct(rate)}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        {s.avg_ms ?? "—"} ms
                        <div className="text-xs text-muted-foreground">
                          p95 {s.p95_ms ?? "—"} ms
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 max-w-3xl text-xs text-muted-foreground">
              Refused is 401/403, which includes bot checks such as Cloudflare challenges. Blocked
              adds refused, rate-limited (429) and timed-out requests. “Not found” is expected for
              careers-site discovery, which probes common paths like /careers and /jobs, and for
              postings that were taken down.
            </p>
          </div>
        )}
      </div>

      {/* Companies ----------------------------------------------------- */}
      <div>
        <SectionHeading title="Companies">
          <Link to="/admin/scout" className={mutedButton}>
            Manage in Job Scout →
          </Link>
        </SectionHeading>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
            <thead>
              <tr className="border-b border-[color:var(--color-hairline)] text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <th className="py-3 font-normal">Company</th>
                <th className="py-3 font-normal">Scanner</th>
                <th className="py-3 font-normal">Last result</th>
                <th className="py-3 font-normal">Last scanned</th>
              </tr>
            </thead>
            <tbody>
              {report.companies.map((c) => {
                const ageMin = c.last_scanned_at
                  ? (Date.now() - Date.parse(c.last_scanned_at)) / 60000
                  : null;
                const overdue = c.enabled && (ageMin === null || ageMin > cycleMin * 2);
                return (
                  <tr
                    key={c.id}
                    className="border-b border-[color:var(--color-hairline)] align-top"
                  >
                    <td className="py-3 font-medium">
                      {c.name}
                      {!c.enabled && (
                        <span className="ml-2 text-xs text-muted-foreground">(paused)</span>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {c.ats ? sourceName(c.ats) : "—"}
                    </td>
                    <td className="py-3">
                      <Badge
                        tone={
                          c.last_status === "ok"
                            ? "good"
                            : c.last_status === "failed_rating" || c.last_status === "failed_ethics"
                              ? "warn"
                              : c.last_status
                                ? "bad"
                                : "muted"
                        }
                      >
                        {c.last_status ?? "never"}
                      </Badge>
                      {c.last_error && c.last_status !== "ok" && (
                        <div className="mt-1 max-w-md text-xs text-muted-foreground">
                          {c.last_error}
                        </div>
                      )}
                    </td>
                    <td className="py-3">
                      {timeAgo(c.last_scanned_at)} {overdue && <Badge tone="warn">overdue</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data quality -------------------------------------------------- */}
      <div>
        <SectionHeading title="Data quality" />
        {ingestSources.length === 0 ? (
          <Empty>No jobs ingested in this window.</Empty>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[60rem] text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
              <thead>
                <tr className="border-b border-[color:var(--color-hairline)] text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  <th className="py-3 font-normal">Source</th>
                  <th className="py-3 text-right font-normal">Live</th>
                  <th className="py-3 text-right font-normal">Flagged</th>
                  <th className="py-3 text-right font-normal">Schema failures</th>
                  {FIELDS.map((f) => (
                    <th key={f} className="py-3 text-right font-normal">
                      {f === "naics_code" ? "sector" : f.replace("_", " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {ingestSources.map((s) => (
                  <tr key={s.source} className="border-b border-[color:var(--color-hairline)]">
                    <td className="py-3 font-medium">{sourceName(s.source)}</td>
                    <td className="py-3 text-right">{s.live_jobs}</td>
                    <td className="py-3 text-right">{s.flagged_jobs}</td>
                    <td
                      className={`py-3 text-right ${s.schema_failures ? "text-red-700" : "text-muted-foreground"}`}
                    >
                      {s.schema_failures} / {s.schema_failures + s.ingested}
                    </td>
                    {FIELDS.map((f) => {
                      const v = s.fill_rates?.[f];
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
            <p className="mt-3 text-xs text-muted-foreground">
              Fill rates are from each source's most recent ingest in this window. Low
              industry/sector fill means the company's row has no sector set.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
