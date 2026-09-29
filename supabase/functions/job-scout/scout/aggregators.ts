// Generated from src/lib/scout/aggregators.ts by scripts/build-scout-function.mjs. Do not edit.
import { HttpError, scoutJson, type MetricsRecorder } from "./http.ts";
import { parsePayText } from "./staffing-boards.ts";
import { htmlToText, iso } from "./text.ts";
import type { AggregatorSource, RawJob } from "./types.ts";

/**
 * Job-aggregator APIs: Adzuna and Jooble. Both are official, keyed search
 * APIs (not scraping), searched with the admin's job-board queries — or a
 * default rotation of common roles around the Bay Area — U.S. market only.
 *
 * Both are metered, so every call goes through a request budget backed by
 * public.scout_api_usage: the pipeline asks `requestAllowance` how many calls
 * it may make, records each one *before* sending it (a failed call still
 * counts against the provider's quota), never retries, and spaces calls out.
 *
 * Terms: Adzuna requires "Jobs by Adzuna" attribution on every displayed ad
 * (the job feed shows it); commercial use past a 14-day trial needs Adzuna's
 * written consent. Jooble's free key is 500 requests for the key's lifetime.
 */

export type ApiBudget = {
  /** Most calls in one scan. */
  perRun: number;
  perDay: number;
  per7Days: number;
  per30Days: number;
  /** Total for the key's lifetime, or null when there's no lifetime cap. */
  lifetime: number | null;
  /** Wait at least this long after the last call before searching again. */
  minHoursBetweenRuns: number;
  /** Spacing between calls within a scan. */
  minMsBetweenRequests: number;
};

export const API_BUDGETS: Record<AggregatorSource, ApiBudget> = {
  // Adzuna's published limits: 25/minute, 250/day, 1,000/week, 2,500/month.
  // 80/day keeps any 31-day month under 2,500; 20 per run, 4 runs a day.
  adzuna: {
    perRun: 20,
    perDay: 80,
    per7Days: 560,
    per30Days: 2400,
    lifetime: null,
    minHoursBetweenRuns: 6,
    minMsBetweenRequests: 3000, // 20/minute, under the 25/minute limit
  },
  // Jooble's free key: 500 requests total, ever. Keep 20 in reserve and spend
  // 8 a day, once a day — about 60 days of searches.
  jooble: {
    perRun: 8,
    perDay: 8,
    per7Days: 56,
    per30Days: 240,
    lifetime: 480,
    minHoursBetweenRuns: 20,
    minMsBetweenRequests: 3000,
  },
};

export type ApiUsage = {
  today: number;
  last7Days: number;
  last30Days: number;
  total: number;
  lastRequestAt: string | null;
};

/** How many calls this scan may make without crossing any limit. */
export function requestAllowance(budget: ApiBudget, usage: ApiUsage, now: Date): number {
  if (
    usage.lastRequestAt &&
    now.getTime() - Date.parse(usage.lastRequestAt) < budget.minHoursBetweenRuns * 3_600_000
  )
    return 0;
  return Math.max(
    0,
    Math.min(
      budget.perRun,
      budget.perDay - usage.today,
      budget.per7Days - usage.last7Days,
      budget.per30Days - usage.last30Days,
      budget.lifetime === null ? Infinity : budget.lifetime - usage.total,
    ),
  );
}

/** Searches used when the admin hasn't set any: common roles, Bay Area. */
export const DEFAULT_AGGREGATOR_QUERIES: { search_term: string; location?: string }[] = [
  "software engineer",
  "accountant",
  "administrative assistant",
  "customer service representative",
  "registered nurse",
  "project manager",
  "sales representative",
  "data analyst",
  "warehouse associate",
  "human resources",
  "marketing coordinator",
  "medical assistant",
  "mechanical engineer",
  "office manager",
  "electrician",
  "financial analyst",
].map((search_term) => ({ search_term, location: "San Francisco, CA" }));

const DEFAULT_LOCATION = "San Francisco, CA";

/**
 * Both APIs carry the key in the URL, and HttpError messages include the URL —
 * which ends up in scout_runs and logs. Re-throw with the key removed.
 */
async function withoutKey<T>(secret: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof HttpError)
      throw new HttpError(
        error.status,
        error.url
          .split(secret)
          .join("[key]")
          .replace(/app_id=[^&]+/, "app_id=[id]"),
      );
    throw error;
  }
}

// ---------------------------------------------------------------- Adzuna

export type AdzunaCredentials = { appId: string; appKey: string };

type AdzunaJob = {
  id: string;
  title?: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string | number;
  contract_time?: string;
  contract_type?: string;
  category?: { label?: string };
};

/** One page (up to 50) of U.S. Adzuna results. Exactly one API call. */
export async function adzunaSearch(
  rec: MetricsRecorder,
  creds: AdzunaCredentials,
  q: { search_term: string; location?: string },
  opts: { page?: number; maxDaysOld?: number } = {},
): Promise<RawJob[]> {
  const params = new URLSearchParams({
    app_id: creds.appId,
    app_key: creds.appKey,
    results_per_page: "50",
    what: q.search_term,
    where: q.location || DEFAULT_LOCATION,
    distance: "80", // km, about 50 miles
    max_days_old: String(opts.maxDaysOld ?? 21),
    sort_by: "date",
    "content-type": "application/json",
  });
  const data = await withoutKey(creds.appKey, () =>
    scoutJson<{ results?: AdzunaJob[] }>(
      rec,
      "adzuna",
      `https://api.adzuna.com/v1/api/jobs/us/search/${opts.page ?? 1}?${params}`,
      { retry: false, timeoutMs: 20_000 },
    ),
  );
  return (data.results ?? [])
    .filter((j) => j.id && j.title && j.company?.display_name)
    .map((j) => {
      // area is ["US", state, county, city]; name the state so the location check can read it.
      const state = j.location?.area?.[1];
      const where = j.location?.display_name ?? null;
      const predicted = String(j.salary_is_predicted ?? "0") === "1";
      return {
        source: "adzuna",
        external_id: String(j.id),
        title: htmlToText(j.title) ?? j.title!,
        company_name: j.company!.display_name!.trim(),
        location: where && state && !where.includes(state) ? `${where}, ${state}` : where,
        description: htmlToText(j.description),
        apply_url: j.redirect_url ?? null,
        department: null,
        employment_type_raw: j.contract_time ?? j.contract_type ?? null,
        remote_hint: null,
        posted_at: iso(j.created),
        industry_raw: j.category?.label ?? null,
        // Adzuna estimates salaries it wasn't given; only keep posted ones.
        pay:
          !predicted && (j.salary_min || j.salary_max)
            ? { min: j.salary_min ?? null, max: j.salary_max ?? null, unit: "year" }
            : null,
        country_hint: "US",
      } satisfies RawJob;
    });
}

// ---------------------------------------------------------------- Jooble

type JoobleJob = {
  id?: string | number;
  title?: string;
  location?: string;
  snippet?: string;
  salary?: string;
  type?: string;
  link?: string;
  company?: string;
  updated?: string;
};

/** One page of U.S. Jooble results (the jooble.org key covers the U.S. only). One API call. */
export async function joobleSearch(
  rec: MetricsRecorder,
  apiKey: string,
  q: { search_term: string; location?: string },
  opts: { page?: number } = {},
): Promise<RawJob[]> {
  const data = await withoutKey(apiKey, () =>
    scoutJson<{ jobs?: JoobleJob[] }>(
      rec,
      "jooble",
      `https://jooble.org/api/${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        body: JSON.stringify({
          keywords: q.search_term,
          location: q.location || DEFAULT_LOCATION,
          radius: "80",
          page: String(opts.page ?? 1),
          ResultOnPage: "50",
        }),
        retry: false,
        timeoutMs: 20_000,
      },
    ),
  );
  return (data.jobs ?? [])
    .filter((j) => j.id && j.title && j.company?.trim())
    .map((j) => {
      const pay = parsePayText(j.salary);
      return {
        source: "jooble",
        external_id: String(j.id),
        title: htmlToText(j.title) ?? j.title!,
        company_name: j.company!.trim(),
        location: j.location?.trim() || null,
        description: htmlToText(j.snippet),
        apply_url: j.link ?? null,
        department: null,
        employment_type_raw: j.type ?? null,
        remote_hint: null,
        posted_at: iso(j.updated),
        pay,
        country_hint: "US",
      } satisfies RawJob;
    });
}
