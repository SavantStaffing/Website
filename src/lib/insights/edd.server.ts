import { FEATURED_OCCUPATIONS, INDUSTRY_SERIES, type Region } from "./regions";

/**
 * California EDD Labor Market Information, read from the state open-data
 * portal's datastore API (data.ca.gov, CKAN `datastore_search_sql`). Public
 * data, no key. Results are cached in memory for a few hours; EDD updates
 * monthly (LAUS, CES) or yearly (OEWS, projections).
 *
 *   LAUS  — Local Area Unemployment Statistics (monthly, by county / metro)
 *   CES   — Current Employment Statistics (monthly jobs by industry)
 *   OEWS  — Occupational Employment and Wage Statistics (yearly pay by occupation)
 *   Projections — Long-term occupational employment projections (10-year)
 */

const API = "https://data.ca.gov/api/3/action/datastore_search_sql";

const RESOURCE = {
  laus: "b4bc4656-7866-420f-8d87-4eda4c9996ed",
  ces2026: "6b23e85b-78ad-4c7d-945d-1fc19b52dcba",
  ces2014to2025: "98b69522-557e-464a-a2be-4226df433da1",
  oews: "aef4c53a-7e17-418c-acc1-d189e39b6caa",
  projections: "274e273c-d18c-4d84-b8df-49b4d13c14ce",
} as const;

const TTL_MS = 6 * 60 * 60 * 1000;
type Row = Record<string, string | number | null>;
const cache = new Map<string, { at: number; rows: Promise<Row[]> }>();

async function query(sql: string): Promise<Row[]> {
  const hit = cache.get(sql);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;
  const rows = (async () => {
    const res = await fetch(`${API}?sql=${encodeURIComponent(sql)}`, {
      headers: { Accept: "application/json", "User-Agent": "SavantStaffing-Insights/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`EDD data request failed (${res.status})`);
    const body = (await res.json()) as { success: boolean; result?: { records: Row[] } };
    if (!body.success || !body.result) throw new Error("EDD data request was rejected");
    return body.result.records;
  })();
  cache.set(sql, { at: Date.now(), rows });
  rows.catch(() => cache.delete(sql)); // don't cache failures
  return rows;
}

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown) => (typeof v === "string" ? v.trim() : v === null ? "" : String(v));

/** LAUS and CES mark San Rafael "MD**"; match both spellings. */
const areaIn = (r: Region) => `"Area Name" IN (${lit(r.edd)}, ${lit(`${r.edd}**`)})`;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const monthLabel = (y: number, m: number) => `${MONTHS[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
const monthLong = (y: number, m: number) => `${MONTHS[m - 1]} ${y}`;

// ---------------------------------------------------------------- unemployment (LAUS)

export type UnemploymentPoint = { key: string; label: string; rate: number };
export type Unemployment = {
  period: string;
  preliminary: boolean;
  rate: number;
  laborForce: number | null;
  employed: number | null;
  unemployed: number | null;
  yearAgoRate: number | null;
  stateRate: number | null;
  trend: UnemploymentPoint[];
};

async function lausSeries(r: Region, sinceYear: number) {
  const rows = await query(
    `SELECT "Year","Date_Numeric","Status","Labor Force","Employment","Unemployment","Unemployment Rate"
     FROM "${RESOURCE.laus}"
     WHERE ${areaIn(r)} AND "Area Type" = ${lit(r.areaType)}
       AND "Seasonally Adjusted(Y/N)" = 'N' AND "Year" >= ${lit(String(sinceYear))}`,
  );
  return rows
    .map((x) => {
      const [m, y] = str(x.Date_Numeric).split("/").map(Number);
      return {
        y,
        m,
        key: `${y}-${String(m).padStart(2, "0")}`,
        status: str(x.Status),
        laborForce: num(x["Labor Force"]),
        employed: num(x.Employment),
        unemployed: num(x.Unemployment),
        rate: num(x["Unemployment Rate"]),
      };
    })
    .filter((x) => x.y && x.m && x.rate !== null)
    .sort((a, b) => a.key.localeCompare(b.key));
}

export async function getUnemployment(r: Region, state: Region): Promise<Unemployment | null> {
  const since = new Date().getFullYear() - 3;
  const [series, stateSeries] = await Promise.all([
    lausSeries(r, since),
    r.slug === state.slug ? Promise.resolve(null) : lausSeries(state, since),
  ]);
  const latest = series.at(-1);
  if (!latest) return null;
  const yearAgo = series.find((x) => x.y === latest.y - 1 && x.m === latest.m);
  const stateSame = (stateSeries ?? series).find((x) => x.key === latest.key);
  return {
    period: monthLong(latest.y, latest.m),
    preliminary: /prelim/i.test(latest.status),
    rate: latest.rate!,
    laborForce: latest.laborForce,
    employed: latest.employed,
    unemployed: latest.unemployed,
    yearAgoRate: yearAgo?.rate ?? null,
    stateRate: stateSame?.rate ?? null,
    trend: series
      .slice(-25)
      .map((x) => ({ key: x.key, label: monthLabel(x.y, x.m), rate: x.rate! })),
  };
}

// ---------------------------------------------------------------- jobs by industry (CES)

export type IndustryTrend = {
  label: string;
  now: number;
  yearAgo: number | null;
  change: number | null;
  pct: number | null;
};
export type JobsTrend = {
  period: string;
  total: number | null;
  totalYearAgo: number | null;
  trend: { key: string; label: string; jobs: number }[];
  industries: IndustryTrend[];
};

async function cesRows(resource: string, r: Region, fromYear: number) {
  // The 2014–2025 file stores codes without leading zeros ("0" for Total
  // Nonfarm); ask for both spellings and pad them back below.
  const wanted = ["00000000", ...INDUSTRY_SERIES.map((s) => s.code)];
  const codes = [...new Set([...wanted, ...wanted.map((c) => String(Number(c)))])]
    .map(lit)
    .join(", ");
  const rows = await query(
    `SELECT "Date","Series Code","Current Employment"
     FROM "${resource}"
     WHERE ${areaIn(r)} AND "Seasonally Adjusted (Y/N)" = 'N'
       AND "Series Code" IN (${codes}) AND "Year" >= ${lit(String(fromYear))}`,
  );
  return rows.map((x) => {
    const [m, , y] = str(x.Date).split("/").map(Number);
    return {
      key: `${y}-${String(m).padStart(2, "0")}`,
      y,
      m,
      code: str(x["Series Code"]).padStart(8, "0"),
      jobs: num(x["Current Employment"]),
    };
  });
}

export async function getJobsTrend(r: Region): Promise<JobsTrend | null> {
  const thisYear = new Date().getFullYear();
  const [recent, older] = await Promise.all([
    cesRows(RESOURCE.ces2026, r, thisYear),
    cesRows(RESOURCE.ces2014to2025, r, thisYear - 2),
  ]);
  const rows = [...older, ...recent].filter((x) => x.y && x.m && x.jobs !== null);
  const totals = rows
    .filter((x) => x.code === "00000000")
    .sort((a, b) => a.key.localeCompare(b.key));
  const latest = totals.at(-1);
  if (!latest) return null;
  const at = (code: string, y: number, m: number) =>
    rows.find((x) => x.code === code && x.y === y && x.m === m)?.jobs ?? null;

  const industries = INDUSTRY_SERIES.flatMap(({ code, label }) => {
    const now = at(code, latest.y, latest.m);
    if (now === null) return [];
    const yearAgo = at(code, latest.y - 1, latest.m);
    const change = yearAgo === null ? null : now - yearAgo;
    return [{ label, now, yearAgo, change, pct: yearAgo ? (change! / yearAgo) * 100 : null }];
  }).sort((a, b) => (b.pct ?? -Infinity) - (a.pct ?? -Infinity));

  return {
    period: monthLong(latest.y, latest.m),
    total: latest.jobs,
    totalYearAgo: at("00000000", latest.y - 1, latest.m),
    trend: totals
      .slice(-25)
      .map((x) => ({ key: x.key, label: monthLabel(x.y, x.m), jobs: x.jobs! })),
    industries,
  };
}

// ---------------------------------------------------------------- pay (OEWS)

export type WageRow = {
  soc: string;
  title: string;
  track: "hourly" | "professional" | null;
  employed: number | null;
  hourly: { p25: number | null; median: number | null; p75: number | null };
  annual: { p25: number | null; median: number | null; p75: number | null };
};
export type Wages = { period: string; rows: WageRow[] };

async function latestOewsYear(r: Region): Promise<string | null> {
  const rows = await query(
    `SELECT MAX("Year") AS y FROM "${RESOURCE.oews}" WHERE "Area Name" = ${lit(r.edd)}`,
  );
  return rows[0]?.y ? str(rows[0].y) : null;
}

function toWageRows(rows: Row[], trackOf: (soc: string) => WageRow["track"]): WageRow[] {
  const bySoc = new Map<string, WageRow>();
  for (const x of rows) {
    const soc = str(x["Standard Occupational Classification"]);
    const w = bySoc.get(soc) ?? {
      soc,
      title: str(x["Occupational Title"]),
      track: trackOf(soc),
      employed: num(x["Number of Employed"]),
      hourly: { p25: null, median: null, p75: null },
      annual: { p25: null, median: null, p75: null },
    };
    const band = {
      p25: num(x["25th Percentile Wage"]),
      median: num(x["50th Percentile (Median) Wage"]),
      p75: num(x["75th Percentile Wage"]),
    };
    if (/hour/i.test(str(x["Wage Type"]))) w.hourly = band;
    else w.annual = band;
    bySoc.set(soc, w);
  }
  return [...bySoc.values()];
}

const WAGE_COLUMNS = `"Standard Occupational Classification","Occupational Title","Wage Type","Number of Employed","25th Percentile Wage","50th Percentile (Median) Wage","75th Percentile Wage"`;

export async function getWages(r: Region): Promise<Wages | null> {
  const year = await latestOewsYear(r);
  if (!year) return null;
  const tracks = new Map(FEATURED_OCCUPATIONS.map((o) => [o.soc, o.track]));
  const rows = await query(
    `SELECT ${WAGE_COLUMNS} FROM "${RESOURCE.oews}"
     WHERE "Area Name" = ${lit(r.edd)} AND "Year" = ${lit(year)}
       AND "Industry Name" = 'Total, All Industry'
       AND "Standard Occupational Classification" IN (${[...tracks.keys()].map(lit).join(", ")})`,
  );
  const order = FEATURED_OCCUPATIONS.map((o) => o.soc);
  return {
    period: `${year} survey`,
    rows: toWageRows(rows, (s) => tracks.get(s) ?? null).sort(
      (a, b) => order.indexOf(a.soc) - order.indexOf(b.soc),
    ),
  };
}

/** Any occupation by title, for the pay lookup. */
export async function searchWages(r: Region, q: string): Promise<WageRow[]> {
  const term = q
    .replace(/[^a-zA-Z0-9 ,&/-]/g, " ")
    .trim()
    .slice(0, 60);
  if (term.length < 2) return [];
  const year = await latestOewsYear(r);
  if (!year) return [];
  const rows = await query(
    `SELECT ${WAGE_COLUMNS} FROM "${RESOURCE.oews}"
     WHERE "Area Name" = ${lit(r.edd)} AND "Year" = ${lit(year)}
       AND "Industry Name" = 'Total, All Industry'
       AND "Occupational Title" ILIKE ${lit(`%${term}%`)}
       AND "Standard Occupational Classification" NOT LIKE '%0000'
     LIMIT 40`,
  );
  return toWageRows(rows, () => null)
    .sort((a, b) => (b.employed ?? 0) - (a.employed ?? 0))
    .slice(0, 12);
}

// ---------------------------------------------------------------- outlook (projections)

export type ProjectionRow = {
  title: string;
  base: number | null;
  projected: number | null;
  pct: number | null;
  openings: number | null;
  medianHourly: number | null;
  medianAnnual: number | null;
  education: string;
};
export type Outlook = {
  period: string;
  overall: ProjectionRow | null;
  mostOpenings: ProjectionRow[];
  fastestGrowing: ProjectionRow[];
};

const toProjection = (x: Row): ProjectionRow => ({
  title: str(x["Occupational Title"]),
  base: num(x["Base Year Employment Estimate"]),
  projected: num(x["Projected Year Employment Estimate"]),
  pct: num(x["Percentage Change"]),
  openings: num(x["Total Job Openings"]),
  medianHourly: num(x["Median Hourly Wage"]),
  medianAnnual: num(x["Median Annual Wage"]),
  education: str(x["Entry Level Education"]),
});

export async function getOutlook(r: Region): Promise<Outlook | null> {
  // Projections name areas "Oakland-Fremont-Berkeley MD (Alameda and Contra Costa Counties)".
  const area =
    r.areaType === "State"
      ? `"Area Name" = ${lit(r.edd)}`
      : `"Area Name" LIKE ${lit(`${r.edd} (%`)}`;
  const cols = `"Period","SOC Level","Occupational Title","Base Year Employment Estimate","Projected Year Employment Estimate","Percentage Change","Total Job Openings","Median Hourly Wage","Median Annual Wage","Entry Level Education"`;
  const [overallRows, openings, growth] = await Promise.all([
    query(`SELECT ${cols} FROM "${RESOURCE.projections}" WHERE ${area} AND "SOC Level" = 1`),
    query(
      `SELECT ${cols} FROM "${RESOURCE.projections}" WHERE ${area} AND "SOC Level" = 4
       ORDER BY "Total Job Openings" DESC NULLS LAST LIMIT 8`,
    ),
    // Growth among occupations big enough to matter locally.
    query(
      `SELECT ${cols} FROM "${RESOURCE.projections}" WHERE ${area} AND "SOC Level" = 4
         AND "Base Year Employment Estimate" >= ${r.areaType === "State" ? 20000 : 1000}
       ORDER BY "Percentage Change" DESC NULLS LAST LIMIT 8`,
    ),
  ]);
  const first = overallRows[0] ?? openings[0];
  if (!first) return null;
  return {
    period: str(first.Period).replace("-", "–"),
    overall: overallRows[0] ? toProjection(overallRows[0]) : null,
    mostOpenings: openings.map(toProjection),
    fastestGrowing: growth.map(toProjection),
  };
}
