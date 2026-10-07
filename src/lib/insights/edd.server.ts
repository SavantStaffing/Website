import { FEATURED_OCCUPATIONS, INDUSTRY_SERIES, type Region } from "./regions";

/**
 * California EDD Labor Market Information from the state open-data portal
 * (data.ca.gov, CKAN). Public data, no key. Results are cached in memory for
 * a few hours; EDD updates monthly (LAUS, CES) or yearly (OEWS, projections).
 *
 *   LAUS  — Local Area Unemployment Statistics (monthly, by county / metro)
 *   CES   — Current Employment Statistics (monthly jobs by industry)
 *   OEWS  — Occupational Employment and Wage Statistics (yearly pay by occupation)
 *   Projections — Long-term occupational employment projections (10-year)
 *
 * The portal re-ingests EDD's files when they're republished, and doesn't
 * keep them stable: column names change ("Seasonally Adjusted (Y/N)" became
 * "seasonally_adjusted__y_n_", "50th Percentile (Median) Wage" became
 * "unsafe_50th_percentile__median__wage"), types change (codes become
 * numbers, dates become ISO), and a dataset's queryable table can disappear
 * for a while. So columns are looked up by a normalized name, values are
 * read in either format, and when a table can't be queried the published
 * CSV file is read instead.
 */

const BASE = "https://data.ca.gov/api/3/action";
const UA = "SavantStaffing-Insights/1.0";

const RESOURCE = {
  laus: "b4bc4656-7866-420f-8d87-4eda4c9996ed",
  ces2026: "6b23e85b-78ad-4c7d-945d-1fc19b52dcba",
  ces2014to2025: "98b69522-557e-464a-a2be-4226df433da1",
  oews: "aef4c53a-7e17-418c-acc1-d189e39b6caa",
  projections: "274e273c-d18c-4d84-b8df-49b4d13c14ce",
} as const;

const TTL_MS = 6 * 60 * 60 * 1000;

/** A record keyed by normalized column name (see norm), whichever source it came from. */
type Rec = Record<string, unknown>;

/** "Seasonally Adjusted (Y/N)", "seasonally_adjusted__y_n_" and "Seasonally Adjusted(Y/N)" are one column. */
const norm = (name: string) =>
  name
    .toLowerCase()
    .replace(/^unsafe_/, "")
    .replace(/[^a-z0-9]/g, "");
const v = (r: Rec, column: string) => r[norm(column)];
const normalize = (raw: Record<string, unknown>): Rec =>
  Object.fromEntries(Object.entries(raw).map(([k, x]) => [norm(k), x]));

class EddError extends Error {}

function cached<T>(
  store: Map<string, { at: number; value: Promise<T> }>,
  key: string,
  load: () => Promise<T>,
) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = load();
  store.set(key, { at: Date.now(), value });
  value.catch(() => store.delete(key)); // don't cache failures
  return value;
}

async function api<T>(action: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE}/${action}?${new URLSearchParams(params)}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    result?: T;
    error?: unknown;
  } | null;
  if (!res.ok || !body?.success || !body.result)
    throw new EddError(
      `EDD ${action} failed (${res.status}): ${JSON.stringify(body?.error ?? "").slice(0, 200)}`,
    );
  return body.result;
}

// ---------------------------------------------------------------- queryable tables

const queryCache = new Map<string, { at: number; value: Promise<Rec[]> }>();
const fieldCache = new Map<string, { at: number; value: Promise<Map<string, string>> }>();

function query(sql: string): Promise<Rec[]> {
  return cached(queryCache, sql, async () => {
    const result = await api<{ records: Record<string, unknown>[] }>("datastore_search_sql", {
      sql,
    });
    return result.records.map(normalize);
  });
}

/** The table's columns, normalized name → actual name. Throws when it can't be queried. */
function fields(resource: string): Promise<Map<string, string>> {
  return cached(fieldCache, resource, async () => {
    const result = await api<{ fields: { id: string }[] }>("datastore_search", {
      resource_id: resource,
      limit: "0",
    });
    return new Map(result.fields.map((f) => [norm(f.id), f.id]));
  });
}

/** A quoting column lookup for building SQL against this table's current column names. */
async function columnsOf(resource: string) {
  const map = await fields(resource);
  return (column: string) => {
    const actual = map.get(norm(column));
    if (!actual) throw new EddError(`EDD column "${column}" is missing from ${resource}`);
    return `"${actual.replace(/"/g, '""')}"`;
  };
}

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const list = (values: string[]) => [...new Set(values)].map(lit).join(", ");

// ---------------------------------------------------------------- published CSV files

const csvCache = new Map<string, { at: number; value: Promise<Rec[]> }>();

/** One CSV line into fields (quoted fields may contain commas and doubled quotes). */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(field);
      field = "";
    } else field += c;
  }
  out.push(field);
  return out;
}

/**
 * The resource's CSV file, streamed and kept only where `keep` says so (the
 * LAUS file is ~25 MB since 1976; we keep the last few years). `key` names
 * the filter for the cache.
 */
function csvRows(resource: string, key: string, keep: (r: Rec) => boolean): Promise<Rec[]> {
  return cached(csvCache, `${resource}:${key}`, async () => {
    const meta = await api<{ url: string }>("resource_show", { id: resource });
    const res = await fetch(meta.url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok || !res.body) throw new EddError(`EDD file download failed (${res.status})`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let header: string[] | null = null;
    let buffer = "";
    const rows: Rec[] = [];
    const take = (line: string) => {
      if (!line.trim()) return;
      const cells = splitCsv(line.replace(/\r$/, ""));
      if (!header) {
        header = cells.map((h) => norm(h.replace(/^﻿/, "")));
        return;
      }
      const r: Rec = {};
      header.forEach((h, i) => (r[h] = cells[i] ?? ""));
      if (keep(r)) rows.push(r);
    };
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.forEach(take);
      if (done) break;
    }
    take(buffer);
    return rows;
  });
}

/** Query the table; if the portal can't serve it right now, read the CSV file instead. */
async function tableOrFile(
  fromTable: () => Promise<Rec[]>,
  fromFile: () => Promise<Rec[]>,
): Promise<Rec[]> {
  try {
    return await fromTable();
  } catch (e) {
    if (!(e instanceof EddError)) throw e;
    return fromFile();
  }
}

// ---------------------------------------------------------------- values in either format

const num = (x: unknown): number | null => {
  const n =
    typeof x === "number"
      ? x
      : typeof x === "string" && x.trim()
        ? Number(x.replace(/,/g, ""))
        : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (x: unknown) =>
  typeof x === "string" ? x.trim() : x === null || x === undefined ? "" : String(x);

/** Year and month from "01/2026", "01/01/2026" or "2026-01-01". */
function yearMonth(x: unknown): { y: number; m: number } | null {
  const s = str(x);
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})-(\d{1,2})/))) return { y: Number(m[1]), m: Number(m[2]) };
  if ((m = s.match(/^(\d{1,2})\/(?:\d{1,2}\/)?(\d{4})/)))
    return { y: Number(m[2]), m: Number(m[1]) };
  return null;
}

/** "29-1141" and 291141 are the same occupation. */
const socDigits = (x: unknown) => str(x).replace(/\D/g, "");
const socForms = (digits: string) => [digits, `${digits.slice(0, 2)}-${digits.slice(2)}`];

/** LAUS and CES mark San Rafael "MD**"; match both spellings. */
const areaNames = (r: Region) => [r.edd, `${r.edd}**`];

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

const notSeasonallyAdjusted = (r: Rec) => /^n/i.test(str(v(r, "Seasonally Adjusted (Y/N)")));

async function lausSeries(r: Region, sinceYear: number) {
  const names = areaNames(r);
  const rows = await tableOrFile(
    async () => {
      const c = await columnsOf(RESOURCE.laus);
      const cols = [
        "Year",
        "Date_Numeric",
        "Status",
        "Labor Force",
        "Employment",
        "Unemployment",
        "Unemployment Rate",
      ];
      return query(
        `SELECT ${cols.map(c).join(",")} FROM "${RESOURCE.laus}"
         WHERE ${c("Area Name")} IN (${list(names)}) AND ${c("Area Type")} = ${lit(r.areaType)}
           AND ${c("Seasonally Adjusted (Y/N)")} = 'N'
           AND CAST(${c("Year")} AS integer) >= ${sinceYear}`,
      );
    },
    async () =>
      (
        await csvRows(
          RESOURCE.laus,
          `since-${sinceYear}`,
          (x) => notSeasonallyAdjusted(x) && (num(v(x, "Year")) ?? 0) >= sinceYear,
        )
      ).filter(
        (x) => names.includes(str(v(x, "Area Name"))) && str(v(x, "Area Type")) === r.areaType,
      ),
  );
  return rows
    .map((x) => {
      const ym = yearMonth(v(x, "Date_Numeric"));
      return {
        y: ym?.y ?? 0,
        m: ym?.m ?? 0,
        key: ym ? `${ym.y}-${String(ym.m).padStart(2, "0")}` : "",
        status: str(v(x, "Status")),
        laborForce: num(v(x, "Labor Force")),
        employed: num(v(x, "Employment")),
        unemployed: num(v(x, "Unemployment")),
        rate: num(v(x, "Unemployment Rate")),
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
  // Series codes may be text ("00000000") or numbers (0); compare as text, both spellings.
  const wanted = ["00000000", ...INDUSTRY_SERIES.map((s) => s.code)];
  const codes = list([...wanted, ...wanted.map((code) => String(Number(code)))]);
  const c = await columnsOf(resource);
  const rows = await query(
    `SELECT ${c("Date")},${c("Series Code")},${c("Current Employment")}
     FROM "${resource}"
     WHERE ${c("Area Name")} IN (${list(areaNames(r))})
       AND ${c("Seasonally Adjusted (Y/N)")} = 'N'
       AND CAST(${c("Series Code")} AS text) IN (${codes})
       AND CAST(${c("Year")} AS integer) >= ${fromYear}`,
  );
  return rows.map((x) => {
    const ym = yearMonth(v(x, "Date"));
    return {
      key: ym ? `${ym.y}-${String(ym.m).padStart(2, "0")}` : "",
      y: ym?.y ?? 0,
      m: ym?.m ?? 0,
      code: str(v(x, "Series Code")).padStart(8, "0"),
      jobs: num(v(x, "Current Employment")),
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

/** EDD has spelled the all-industries row both ways. */
const ALL_INDUSTRIES = list(["Total, All Industry", "Total, All Industries"]);

async function latestOewsYear(r: Region): Promise<number | null> {
  const c = await columnsOf(RESOURCE.oews);
  const rows = await query(
    `SELECT MAX(CAST(${c("Year")} AS integer)) AS y FROM "${RESOURCE.oews}"
     WHERE ${c("Area Name")} = ${lit(r.edd)}`,
  );
  return rows[0] ? num(rows[0].y) : null;
}

function toWageRows(rows: Rec[], trackOf: (soc: string) => WageRow["track"]): WageRow[] {
  const bySoc = new Map<string, WageRow>();
  for (const x of rows) {
    const soc = socDigits(v(x, "Standard Occupational Classification"));
    const w = bySoc.get(soc) ?? {
      soc,
      title: str(v(x, "Occupational Title")),
      track: trackOf(soc),
      employed: num(v(x, "Number of Employed")),
      hourly: { p25: null, median: null, p75: null },
      annual: { p25: null, median: null, p75: null },
    };
    const band = {
      p25: num(v(x, "25th Percentile Wage")),
      median: num(v(x, "50th Percentile (Median) Wage")),
      p75: num(v(x, "75th Percentile Wage")),
    };
    if (/hour/i.test(str(v(x, "Wage Type")))) w.hourly = band;
    else w.annual = band;
    bySoc.set(soc, w);
  }
  return [...bySoc.values()];
}

const WAGE_COLUMNS = [
  "Standard Occupational Classification",
  "Occupational Title",
  "Wage Type",
  "Number of Employed",
  "25th Percentile Wage",
  "50th Percentile (Median) Wage",
  "75th Percentile Wage",
];

export async function getWages(r: Region): Promise<Wages | null> {
  const year = await latestOewsYear(r);
  if (!year) return null;
  const c = await columnsOf(RESOURCE.oews);
  const tracks = new Map(FEATURED_OCCUPATIONS.map((o) => [o.soc, o.track]));
  const rows = await query(
    `SELECT ${WAGE_COLUMNS.map(c).join(",")} FROM "${RESOURCE.oews}"
     WHERE ${c("Area Name")} = ${lit(r.edd)} AND CAST(${c("Year")} AS integer) = ${year}
       AND ${c("Industry Name")} IN (${ALL_INDUSTRIES})
       AND CAST(${c("Standard Occupational Classification")} AS text)
         IN (${list([...tracks.keys()].flatMap(socForms))})`,
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
  const c = await columnsOf(RESOURCE.oews);
  const rows = await query(
    `SELECT ${WAGE_COLUMNS.map(c).join(",")} FROM "${RESOURCE.oews}"
     WHERE ${c("Area Name")} = ${lit(r.edd)} AND CAST(${c("Year")} AS integer) = ${year}
       AND ${c("Industry Name")} IN (${ALL_INDUSTRIES})
       AND ${c("Occupational Title")} ILIKE ${lit(`%${term}%`)}
       AND CAST(${c("Standard Occupational Classification")} AS text) NOT LIKE '%0000'
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

const toProjection = (x: Rec): ProjectionRow => ({
  title: str(v(x, "Occupational Title")),
  base: num(v(x, "Base Year Employment Estimate")),
  projected: num(v(x, "Projected Year Employment Estimate")),
  pct: num(v(x, "Percentage Change")),
  openings: num(v(x, "Total Job Openings")),
  medianHourly: num(v(x, "Median Hourly Wage")),
  medianAnnual: num(v(x, "Median Annual Wage")),
  education: str(v(x, "Entry Level Education")),
});

/** Projections name areas "Oakland-Fremont-Berkeley MD (Alameda and Contra Costa Counties)". */
const projectionArea = (r: Region, name: string) =>
  r.areaType === "State" ? name === r.edd : name.startsWith(`${r.edd} (`);

export async function getOutlook(r: Region): Promise<Outlook | null> {
  // A whole area is a few hundred occupations, so sort and pick here.
  const rows = (
    await tableOrFile(
      async () => {
        const c = await columnsOf(RESOURCE.projections);
        const area =
          r.areaType === "State"
            ? `${c("Area Name")} = ${lit(r.edd)}`
            : `${c("Area Name")} LIKE ${lit(`${r.edd} (%`)}`;
        return query(
          `SELECT * FROM "${RESOURCE.projections}"
           WHERE ${area} AND CAST(${c("SOC Level")} AS integer) IN (1, 4)`,
        );
      },
      () =>
        csvRows(RESOURCE.projections, "levels-1-4", (x) =>
          ["1", "4"].includes(str(v(x, "SOC Level"))),
        ),
    )
  ).filter((x) => projectionArea(r, str(v(x, "Area Name"))));

  const level = (x: Rec) => num(v(x, "SOC Level"));
  const detailed = rows.filter((x) => level(x) === 4).map(toProjection);
  const overallRow = rows.find((x) => level(x) === 1);
  const first = overallRow ?? rows.find((x) => level(x) === 4);
  if (!first) return null;

  const minBase = r.areaType === "State" ? 20000 : 1000;
  const top = (from: ProjectionRow[], by: (p: ProjectionRow) => number | null) =>
    [...from].sort((a, b) => (by(b) ?? -Infinity) - (by(a) ?? -Infinity)).slice(0, 8);
  return {
    period: str(v(first, "Period")).replace("-", "–"),
    overall: overallRow ? toProjection(overallRow) : null,
    mostOpenings: top(detailed, (p) => p.openings),
    // Growth among occupations big enough to matter locally.
    fastestGrowing: top(
      detailed.filter((p) => (p.base ?? 0) >= minBase),
      (p) => p.pct,
    ),
  };
}
