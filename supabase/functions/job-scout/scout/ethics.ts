// Generated from src/lib/scout/ethics.ts by scripts/build-scout-function.mjs. Do not edit.
import { scoutFetch, type MetricsRecorder } from "./http.ts";
import { normalizeCompanyName } from "./ratings.ts";

/**
 * Employer ethics, fetched live when the Job Scout validates a company and
 * cached in public.employer_ethics (ETHICS_TTL_DAYS). Two open sources:
 *
 *   World Benchmarking Alliance Social Benchmark, via Wikirate's API
 *   (CC BY 4.0 — attribution required wherever the scores are shown):
 *     Theme B "Provide and promote decent work" → Fair Pay & Worker Respect
 *     Theme A "Respect human rights"           → Respect for Cultures & Communities
 *     Theme C "Act ethically"                  → Honest & Fair Business
 *   Each theme is scored 0–10 by WBA; we store it ×10 (0–100). Only the
 *   ~2,000 companies WBA benchmarks have these.
 *
 *   U.S. Department of Labor enforcement data (public domain, API key):
 *     WHD wage cases and OSHA inspections at Bay Area addresses over the
 *     last DOL_LOOKBACK_YEARS — evidence, not a score.
 */

export const ETHICS_TTL_DAYS = 30;
export const ETHICS_ATTRIBUTION =
  "Social Benchmark scores: World Benchmarking Alliance via Wikirate.org, CC BY 4.0. Labor records: U.S. Department of Labor.";

const WIKIRATE = "https://wikirate.org";
const DOL = "https://apiprod.dol.gov/v4/get";
const DOL_LOOKBACK_YEARS = 5;
const UA = "SavantJobScout/1.0 (+https://savantalent.com; info@savantalent.com)";
const THEMES = {
  fair_pay: "World Benchmarking Alliance+CSI Theme B - Provide and promote decent work",
  cultures: "World Benchmarking Alliance+CSI Theme A - Respect human rights",
  honest: "World Benchmarking Alliance+CSI Theme C - Act ethically",
} as const;

export type EthicsRecord = {
  company_key: string;
  company_name: string;
  wikirate_company: string | null;
  wba_year: number | null;
  fair_pay_score: number | null;
  cultures_score: number | null;
  honest_score: number | null;
  dol_checked: boolean;
  dol_wage_cases: number;
  dol_back_wages: number;
  dol_employees_owed: number;
  dol_repeat_violator: boolean;
  osha_inspections: number;
  osha_serious_violations: number;
  osha_penalties: number;
  sources: string[];
  fetched_at: string;
};

export const ethicsKey = (name: string) => normalizeCompanyName(name);

/** Bay Area ZIPs: 940–949 (SF, Peninsula, East Bay, Marin, Napa, Solano), 950–951 (South Bay), 954 (Sonoma). */
export const isBayAreaZip = (zip: string | null | undefined) => /^9(4\d|5[01]|54)/.test(zip ?? "");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const card = (name: string) => encodeURIComponent(name.replace(/ /g, "_")).replace(/%2B/g, "+");
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Wikirate asks programmatic clients to send an API key (free, from a
 * Wikirate account's Accounts tab). Without one, its Cloudflare protection
 * may challenge automated requests; we don't try to get around that.
 */
let wikirateKey: string | null = null;
export function setWikirateKey(key: string | null | undefined) {
  wikirateKey = key?.trim() || null;
}

async function wikirateJson<T>(rec: MetricsRecorder, url: string): Promise<T | null> {
  try {
    const headers: Record<string, string> = { "User-Agent": UA };
    if (wikirateKey) headers["X-API-Key"] = wikirateKey;
    const res = await scoutFetch(rec, "wikirate", url, { headers, timeoutMs: 20_000 });
    const text = await res.text();
    // Cloudflare can answer with a challenge page instead; treat as unavailable.
    return text.trimStart().startsWith("{") ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

/** The Wikirate company card for an employer name, preferring an exact match. */
export async function resolveWikirateCompany(
  rec: MetricsRecorder,
  name: string,
): Promise<string | null> {
  const want = ethicsKey(name);
  if (!want) return null;
  const j = await wikirateJson<{ items?: { name: string }[] }>(
    rec,
    `${WIKIRATE}/Company.json?limit=10&filter%5Bname%5D=${encodeURIComponent(name)}`,
  );
  const names = (j?.items ?? []).map((i) => i.name.replace(/\s+/g, " ").trim());
  // Skip regional subsidiaries: "Nvidia International Inc. (China)".
  const candidates = names.filter((n) => !/\(.*\)$/.test(n));
  return (
    candidates.find((n) => ethicsKey(n) === want) ??
    candidates.find((n) => ethicsKey(n).startsWith(want) || want.startsWith(ethicsKey(n))) ??
    null
  );
}

async function latestAnswer(
  rec: MetricsRecorder,
  metric: string,
  company: string,
): Promise<{ year: number; value: number } | null> {
  const j = await wikirateJson<{ items?: { year: number; value: string }[] }>(
    rec,
    `${WIKIRATE}/${card(metric)}+${card(company)}.json`,
  );
  const items = (j?.items ?? []).filter((i) => i.value !== null && !isNaN(Number(i.value)));
  if (!items.length) return null;
  const best = items.reduce((a, b) => (b.year > a.year ? b : a));
  return { year: best.year, value: Number(best.value) };
}

// ---------------------------------------------------------------- Department of Labor

type DolFilter = { field: string; operator: string; value: unknown };

async function dolQuery<T>(
  rec: MetricsRecorder,
  key: string,
  dataset: string,
  filter: DolFilter | { and: DolFilter[] },
  fields: string[],
  limit = 200,
): Promise<T[]> {
  const url =
    `${DOL}/${dataset}/json?limit=${limit}` +
    `&fields=${fields.join(",")}` +
    `&filter_object=${encodeURIComponent(JSON.stringify(filter))}` +
    `&X-API-KEY=${encodeURIComponent(key)}`;
  const res = await scoutFetch(rec, "dol", url, { timeoutMs: 45_000 });
  // No matching records comes back as 204 with an empty body.
  const text = await res.text();
  if (!text.trim()) return [];
  const j = JSON.parse(text) as { data?: T[] };
  return j.data ?? [];
}

/** A DOL name search term, or null when the name is too short to search safely. */
function dolTerm(name: string): string | null {
  const t = name
    .replace(
      /\b(inc|incorporated|corp|corporation|co|company|llc|ltd|plc|group|holdings)\.?$/gi,
      "",
    )
    .replace(/[^\w &'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length >= 4 ? t : null;
}

/** Whole-word match, so "Apple" doesn't pick up "Applebee's". */
const namedLike = (term: string) =>
  new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

async function fetchDol(rec: MetricsRecorder, key: string, name: string, now: Date) {
  const term = dolTerm(name);
  const empty = {
    dol_checked: false,
    dol_wage_cases: 0,
    dol_back_wages: 0,
    dol_employees_owed: 0,
    dol_repeat_violator: false,
    osha_inspections: 0,
    osha_serious_violations: 0,
    osha_penalties: 0,
  };
  if (!term) return empty;
  const since = new Date(now.getTime() - DOL_LOOKBACK_YEARS * 365 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const match = namedLike(term);

  const wage = (
    await dolQuery<{
      trade_nm: string | null;
      legal_name: string | null;
      zip_cd: string | null;
      bw_atp_amt: number | null;
      ee_atp_cnt: number | null;
      case_violtn_cnt: number | null;
      flsa_repeat_violator: string | null;
    }>(
      rec,
      key,
      "WHD/enforcement",
      {
        and: [
          { field: "st_cd", operator: "eq", value: "CA" },
          { field: "trade_nm", operator: "like", value: `%${term}%` },
          { field: "findings_end_date", operator: "gt", value: since },
        ],
      },
      [
        "trade_nm",
        "legal_name",
        "zip_cd",
        "bw_atp_amt",
        "ee_atp_cnt",
        "case_violtn_cnt",
        "flsa_repeat_violator",
      ],
    )
  ).filter(
    (c) =>
      isBayAreaZip(c.zip_cd) && (match.test(c.trade_nm ?? "") || match.test(c.legal_name ?? "")),
  );
  const wageCases = wage.filter((c) => (c.case_violtn_cnt ?? 0) > 0 || (c.bw_atp_amt ?? 0) > 0);

  const inspections = (
    await dolQuery<{ activity_nr: number; estab_name: string | null; site_zip: string | null }>(
      rec,
      key,
      "OSHA/inspection",
      {
        and: [
          { field: "site_state", operator: "eq", value: "CA" },
          { field: "estab_name", operator: "like", value: `%${term.toUpperCase()}%` },
          { field: "open_date", operator: "gt", value: since },
        ],
      },
      ["activity_nr", "estab_name", "site_zip"],
    )
  ).filter((i) => isBayAreaZip(i.site_zip) && match.test(i.estab_name ?? ""));

  let serious = 0;
  let penalties = 0;
  const ids = inspections.map((i) => i.activity_nr).slice(0, 60);
  if (ids.length) {
    const violations = await dolQuery<{
      viol_type: string | null;
      current_penalty: number | null;
      initial_penalty: number | null;
    }>(
      rec,
      key,
      "OSHA/violation",
      { field: "activity_nr", operator: "in", value: ids },
      ["viol_type", "current_penalty", "initial_penalty"],
      500,
    );
    // S = serious, W = willful, R = repeat.
    serious = violations.filter((v) => /^[SWR]$/.test(v.viol_type ?? "")).length;
    penalties = violations.reduce(
      (sum, v) => sum + (v.current_penalty ?? v.initial_penalty ?? 0),
      0,
    );
  }

  return {
    dol_checked: true,
    dol_wage_cases: wageCases.length,
    dol_back_wages: Math.round(wageCases.reduce((s, c) => s + (c.bw_atp_amt ?? 0), 0)),
    dol_employees_owed: wageCases.reduce((s, c) => s + (c.ee_atp_cnt ?? 0), 0),
    dol_repeat_violator: wage.some((c) => /^y/i.test(c.flsa_repeat_violator ?? "")),
    osha_inspections: inspections.length,
    osha_serious_violations: serious,
    osha_penalties: Math.round(penalties),
  };
}

// ---------------------------------------------------------------- entry point

/**
 * Look up one employer. `lookupName` is what to search for (the company's
 * rating alias when it has one). Never throws: a source that fails simply
 * leaves its fields empty.
 */
export async function fetchEthics(
  rec: MetricsRecorder,
  companyName: string,
  opts: { lookupName?: string | null; dolApiKey?: string | null; now?: Date } = {},
): Promise<EthicsRecord> {
  const now = opts.now ?? new Date();
  const lookup = opts.lookupName || companyName;
  const sources: string[] = [];

  let wikirate: string | null = null;
  let year: number | null = null;
  const scores: Record<keyof typeof THEMES, number | null> = {
    fair_pay: null,
    cultures: null,
    honest: null,
  };
  wikirate = await resolveWikirateCompany(rec, lookup);
  if (wikirate) {
    for (const [k, metric] of Object.entries(THEMES) as [keyof typeof THEMES, string][]) {
      await sleep(1200); // be gentle with Wikirate
      const a = await latestAnswer(rec, metric, wikirate);
      if (a) {
        scores[k] = round1(a.value * 10);
        year = Math.max(year ?? 0, a.year);
      }
    }
    if (year) sources.push(`${WIKIRATE}/${card(wikirate)}`);
  }

  let dol: Awaited<ReturnType<typeof fetchDol>> | null = null;
  if (opts.dolApiKey) {
    try {
      dol = await fetchDol(rec, opts.dolApiKey, lookup, now);
      if (dol.dol_checked) sources.push("https://enforcedata.dol.gov");
    } catch {
      dol = null;
    }
  }

  return {
    company_key: ethicsKey(companyName),
    company_name: companyName,
    wikirate_company: year ? wikirate : null,
    wba_year: year,
    fair_pay_score: scores.fair_pay,
    cultures_score: scores.cultures,
    honest_score: scores.honest,
    dol_checked: dol?.dol_checked ?? false,
    dol_wage_cases: dol?.dol_wage_cases ?? 0,
    dol_back_wages: dol?.dol_back_wages ?? 0,
    dol_employees_owed: dol?.dol_employees_owed ?? 0,
    dol_repeat_violator: dol?.dol_repeat_violator ?? false,
    osha_inspections: dol?.osha_inspections ?? 0,
    osha_serious_violations: dol?.osha_serious_violations ?? 0,
    osha_penalties: dol?.osha_penalties ?? 0,
    sources,
    fetched_at: now.toISOString(),
  };
}

export const ethicsIsFresh = (e: Pick<EthicsRecord, "fetched_at">, now = new Date()) =>
  now.getTime() - Date.parse(e.fetched_at) < ETHICS_TTL_DAYS * 86_400_000;
