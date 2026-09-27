import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { label, mutedButton } from "@/components/site/ui";
import { getRegionInsights, searchOccupationPay } from "@/lib/insights/insights.functions";
import { DEFAULT_REGION, REGIONS } from "@/lib/insights/regions";
import { JOB_TRACK_LABELS, type JobTrack } from "@/lib/scout/track";

export const Route = createFileRoute("/insights")({
  validateSearch: (s: Record<string, unknown>): { region?: string } =>
    typeof s.region === "string" ? { region: s.region } : {},
  loaderDeps: ({ search }) => ({ region: search.region ?? DEFAULT_REGION }),
  loader: ({ deps }) => getRegionInsights({ data: { region: deps.region } }),
  head: () => ({
    meta: [
      { title: "Insights — Savant Staffing" },
      {
        name: "description",
        content:
          "California job market trends by region: unemployment, jobs by industry, pay by occupation and 10-year outlook, from EDD labor market data.",
      },
    ],
  }),
  component: Insights,
});

type Data = Awaited<ReturnType<typeof getRegionInsights>>;
type WageRow = NonNullable<Data["wages"]>["rows"][number];

const int = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : Math.round(n).toLocaleString("en-US");
const usd = (n: number | null | undefined, cents = false) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: cents ? 2 : 0,
        maximumFractionDigits: cents ? 2 : 0,
      });
const usdK = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `$${Math.round(n / 1000)}K`;
const signed = (n: number | null | undefined, digits = 1, unit = "%") =>
  n === null || n === undefined ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(digits)}${unit}`;

function Insights() {
  const data = Route.useLoaderData();
  const navigate = useNavigate({ from: "/insights" });
  const { unemployment: u, jobs, wages, outlook } = data;
  const jobsYoY =
    jobs?.total && jobs.totalYearAgo
      ? ((jobs.total - jobs.totalYearAgo) / jobs.totalYearAgo) * 100
      : null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Insights</p>
      <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">
        The job market, by region.
      </h1>
      <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Unemployment, hiring by industry, what jobs pay and where demand is heading, from the
        California Employment Development Department's labor market data. Updated as EDD publishes.
      </p>

      <div className="mt-12 flex flex-wrap items-end justify-between gap-6 border-b border-[color:var(--color-hairline)] pb-8">
        <label className="block">
          <span className={label}>Region</span>
          <select
            value={data.region.slug}
            onChange={(e) => navigate({ search: { region: e.target.value }, resetScroll: false })}
            className="mt-2 block min-w-[18rem] border-b border-foreground bg-transparent py-2 text-2xl font-medium outline-none"
          >
            {[...new Set(REGIONS.map((r) => r.group))].map((g) => (
              <optgroup key={g} label={g}>
                {REGIONS.filter((r) => r.group === g).map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <p className="text-sm text-muted-foreground">{data.region.counties}</p>
      </div>

      {/* ---------------------------------------------------------- headline numbers */}
      <section className="mt-12 grid gap-px overflow-hidden border border-[color:var(--color-hairline)] bg-[color:var(--color-hairline)] sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="Unemployment rate"
          value={u ? `${u.rate.toFixed(1)}%` : "—"}
          note={
            u
              ? [
                  u.yearAgoRate !== null &&
                    `${signed(u.rate - u.yearAgoRate, 1, " pts")} vs a year ago`,
                  u.stateRate !== null &&
                    data.region.slug !== "california" &&
                    `California ${u.stateRate.toFixed(1)}%`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Unavailable right now"
          }
          foot={u ? `${u.period}${u.preliminary ? " (preliminary)" : ""}` : undefined}
        />
        <Stat
          title="Jobs (nonfarm payroll)"
          value={int(jobs?.total)}
          note={jobsYoY === null ? "Unavailable right now" : `${signed(jobsYoY)} vs a year ago`}
          foot={jobs?.period}
        />
        <Stat
          title="Labor force"
          value={int(u?.laborForce)}
          note={u ? `${int(u.employed)} employed · ${int(u.unemployed)} looking` : "—"}
          foot={u?.period}
        />
        <Stat
          title="10-year job growth"
          value={outlook?.overall ? signed(outlook.overall.pct) : "—"}
          note={
            outlook?.overall
              ? `${int(outlook.overall.openings)} openings expected, including turnover`
              : "Unavailable right now"
          }
          foot={outlook ? `Projection ${outlook.period}` : undefined}
        />
      </section>

      {/* ---------------------------------------------------------- trends */}
      <section className="mt-20 grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold">Unemployment trend</h2>
          <p className="mt-2 text-sm text-muted-foreground">Monthly rate, last two years.</p>
          {u?.trend.length ? (
            <TrendChart
              data={u.trend}
              dataKey="rate"
              name="Unemployment rate"
              format={(v) => `${v.toFixed(1)}%`}
              kind="line"
            />
          ) : (
            <Unavailable />
          )}
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Total jobs</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Nonfarm payroll jobs, last two years.
          </p>
          {jobs?.trend.length ? (
            <TrendChart
              data={jobs.trend}
              dataKey="jobs"
              name="Jobs"
              format={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${Math.round(v / 1000)}K`)}
              kind="area"
            />
          ) : (
            <Unavailable />
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------- industries */}
      <section className="mt-24">
        <h2 className="text-3xl font-semibold">Where hiring is growing</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Jobs by industry, compared with the same month a year earlier
          {jobs ? ` (${jobs.period})` : ""}.
        </p>
        {jobs?.industries.length ? <Industries rows={jobs.industries} /> : <Unavailable />}
      </section>

      {/* ---------------------------------------------------------- pay */}
      <section className="mt-24">
        <h2 className="text-3xl font-semibold">What jobs pay here</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Median pay and the typical range (middle half of workers) for common roles
          {wages ? `, from the ${wages.period}` : ""}. Search for any other occupation below.
        </p>
        {wages?.rows.length ? <PayTable rows={wages.rows} /> : <Unavailable />}
        <PaySearch region={data.region.slug} />
      </section>

      {/* ---------------------------------------------------------- outlook */}
      <section className="mt-24">
        <h2 className="text-3xl font-semibold">Where demand is heading</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          EDD's 10-year occupational projections{outlook ? ` (${outlook.period})` : ""}. Openings
          include new jobs plus people retiring or changing careers.
        </p>
        {outlook ? (
          <div className="mt-10 grid gap-12 lg:grid-cols-2">
            <OutlookList title="Most job openings" rows={outlook.mostOpenings} metric="openings" />
            <OutlookList title="Fastest growing" rows={outlook.fastestGrowing} metric="growth" />
          </div>
        ) : (
          <Unavailable />
        )}
      </section>

      <section className="mt-24 flex flex-wrap items-center justify-between gap-6 border border-[color:var(--color-hairline)] p-8">
        <div>
          <div className="text-xl font-medium">Ready to act on it?</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Browse open roles, from same-week shifts to career positions.
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          <Link to="/jobs" search={{ track: "hourly" }} className={mutedButton}>
            Temp & hourly roles →
          </Link>
          <Link to="/jobs" search={{ track: "professional" }} className={mutedButton}>
            Professional roles →
          </Link>
        </div>
      </section>

      <p className="mt-16 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Source: California Employment Development Department, Labor Market Information Division, via
        the{" "}
        <a
          href="https://data.ca.gov/organization/california-employment-development-department"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          California Open Data Portal
        </a>
        : Local Area Unemployment Statistics, Current Employment Statistics, Occupational Employment
        and Wage Statistics, and Long-Term Occupational Employment Projections. Monthly figures are
        not seasonally adjusted; recent months are preliminary and may be revised.
      </p>
    </div>
  );
}

function Stat({
  title,
  value,
  note,
  foot,
}: {
  title: string;
  value: string;
  note?: string;
  foot?: string;
}) {
  return (
    <div className="bg-background p-6">
      <div className={label}>{title}</div>
      <div className="mt-3 text-4xl font-semibold tabular-nums">{value}</div>
      {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
      {foot && (
        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{foot}</p>
      )}
    </div>
  );
}

function Unavailable() {
  return (
    <p className="mt-6 text-sm text-muted-foreground">
      EDD data for this section isn't available right now. Try again shortly.
    </p>
  );
}

function TrendChart({
  data,
  dataKey,
  name,
  format,
  kind,
}: {
  data: { key: string; label: string; [k: string]: string | number }[];
  dataKey: string;
  name: string;
  format: (v: number) => string;
  kind: "line" | "area";
}) {
  const config: ChartConfig = { [dataKey]: { label: name, color: "var(--color-brass)" } };
  const values = data.map((d) => Number(d[dataKey]));
  const pad = (Math.max(...values) - Math.min(...values)) * 0.15 || 1;
  const domain = [Math.max(0, Math.min(...values) - pad), Math.max(...values) + pad];
  const axis = {
    tickLine: false,
    axisLine: false,
    tick: { fontSize: 11 },
  };
  return (
    <ChartContainer config={config} className="mt-6 aspect-auto h-64 w-full">
      {kind === "line" ? (
        <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={24} />
          <YAxis {...axis} width={48} domain={domain} tickFormatter={format} />
          <ChartTooltip content={<ChartTooltipContent formatter={(v) => format(Number(v))} />} />
          <Line
            dataKey={dataKey}
            name={name}
            type="monotone"
            stroke={`var(--color-${dataKey})`}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      ) : (
        <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={24} />
          <YAxis {...axis} width={56} domain={domain} tickFormatter={format} />
          <ChartTooltip content={<ChartTooltipContent formatter={(v) => int(Number(v))} />} />
          <Area
            dataKey={dataKey}
            name={name}
            type="monotone"
            stroke={`var(--color-${dataKey})`}
            fill={`var(--color-${dataKey})`}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      )}
    </ChartContainer>
  );
}

function Industries({ rows }: { rows: NonNullable<Data["jobs"]>["industries"] }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.pct ?? 0)), 1);
  return (
    <ul className="mt-10 border-t border-[color:var(--color-hairline)]">
      {rows.map((r) => {
        const pct = r.pct ?? 0;
        const width = `${(Math.abs(pct) / max) * 50}%`;
        return (
          <li
            key={r.label}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-b border-[color:var(--color-hairline)] py-4 md:grid-cols-[16rem_minmax(0,1fr)_7rem_7rem]"
          >
            <div className="font-medium">{r.label}</div>
            <div className="relative order-3 col-span-2 h-2 md:order-none md:col-span-1">
              <div className="absolute inset-y-0 left-1/2 w-px bg-[color:var(--color-hairline)]" />
              <div
                className={`absolute inset-y-0 rounded-sm ${pct >= 0 ? "left-1/2 bg-[color:var(--color-brass)]" : "right-1/2 bg-foreground/40"}`}
                style={{ width }}
              />
            </div>
            <div
              className={`text-right tabular-nums ${pct > 0 ? "text-emerald-700 dark:text-emerald-400" : pct < 0 ? "text-red-700 dark:text-red-400" : ""}`}
            >
              {signed(r.pct)}
            </div>
            <div className="hidden text-right text-sm tabular-nums text-muted-foreground md:block">
              {int(r.now)} jobs
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PayTable({ rows }: { rows: WageRow[] }) {
  const [track, setTrack] = useState<JobTrack>("hourly");
  const shown = rows.filter((r) => r.track === track);
  return (
    <div className="mt-8">
      <div
        role="tablist"
        className="inline-grid grid-cols-2 border border-[color:var(--color-hairline)]"
      >
        {(["hourly", "professional"] as JobTrack[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={track === t}
            onClick={() => setTrack(t)}
            className={`px-5 py-3 text-[11px] font-medium uppercase tracking-[0.18em] ${track === t ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {JOB_TRACK_LABELS[t]}
          </button>
        ))}
      </div>
      <WageTable rows={shown} emphasis={track === "hourly" ? "hourly" : "annual"} />
    </div>
  );
}

function WageTable({ rows, emphasis }: { rows: WageRow[]; emphasis: "hourly" | "annual" }) {
  if (rows.length === 0)
    return <p className="mt-6 text-sm text-muted-foreground">No pay data for these roles here.</p>;
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
        <thead>
          <tr className="border-b border-[color:var(--color-hairline)] text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <th className="py-3 font-normal">Occupation</th>
            <th className="py-3 text-right font-normal">
              Median {emphasis === "hourly" ? "hourly" : "salary"}
            </th>
            <th className="py-3 text-right font-normal">Typical range</th>
            <th className="py-3 text-right font-normal">
              {emphasis === "hourly" ? "Per year" : "Per hour"}
            </th>
            <th className="py-3 text-right font-normal">Employed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const main = emphasis === "hourly" ? r.hourly : r.annual;
            const fmt = emphasis === "hourly" ? (n: number | null) => usd(n, true) : usdK;
            return (
              <tr key={r.soc} className="border-b border-[color:var(--color-hairline)]">
                <td className="py-3 font-medium">{r.title}</td>
                <td className="py-3 text-right text-base font-semibold tabular-nums">
                  {fmt(main.median)}
                </td>
                <td className="whitespace-nowrap py-3 text-right tabular-nums text-muted-foreground">
                  {main.p25 !== null && main.p75 !== null
                    ? `${fmt(main.p25)} – ${fmt(main.p75)}`
                    : "—"}
                </td>
                <td className="py-3 text-right tabular-nums text-muted-foreground">
                  {emphasis === "hourly" ? usdK(r.annual.median) : usd(r.hourly.median, true)}
                </td>
                <td className="py-3 text-right tabular-nums text-muted-foreground">
                  {int(r.employed)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PaySearch({ region }: { region: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<WageRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    try {
      setRows(await searchOccupationPay({ data: { region, q: q.trim() } }));
    } catch {
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-12 rounded-sm border border-[color:var(--color-hairline)] p-6">
      <form onSubmit={search} className="flex flex-wrap items-end gap-4">
        <label className="block min-w-[16rem] flex-1">
          <span className={label}>Look up any occupation</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. forklift, medical assistant, data scientist"
            className="mt-2 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-2 text-base outline-none focus:border-foreground"
          />
        </label>
        <button type="submit" disabled={busy} className={mutedButton}>
          {busy ? "Searching…" : "Search pay"}
        </button>
      </form>
      {rows && rows.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          No occupations match that here. Try a broader word.
        </p>
      )}
      {rows && rows.length > 0 && <WageTable rows={rows} emphasis="hourly" />}
    </div>
  );
}

function OutlookList({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: NonNullable<Data["outlook"]>["mostOpenings"];
  metric: "openings" | "growth";
}) {
  return (
    <div>
      <div className={label}>{title}</div>
      <ol className="mt-4 border-t border-[color:var(--color-hairline)]">
        {rows.map((r, i) => (
          <li
            key={r.title}
            className="flex items-baseline gap-4 border-b border-[color:var(--color-hairline)] py-4"
          >
            <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{r.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {[
                  r.medianHourly ? `${usd(r.medianHourly, true)}/hr median` : null,
                  r.education && r.education !== "N/A" ? r.education : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold tabular-nums">
                {metric === "openings" ? int(r.openings) : signed(r.pct)}
              </div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                {metric === "openings" ? "openings" : `${int(r.base)} now`}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
