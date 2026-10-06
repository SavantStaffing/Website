/**
 * Savant Employer Rating: one 0–100 score and a plain-language tier per
 * employer, combining every independent source the Job Scout collects.
 * There are two routes to a rating, depending on which sources cover the
 * employer.
 *
 * Standard route — employers JUST Capital and/or As You Sow cover:
 *
 *   Component                          Source                            Weight
 *   Fair pay & worker respect          WBA Social Benchmark, Theme B      25
 *   Respect for cultures & communities WBA Social Benchmark, Theme A      10
 *   Honest & fair business             WBA Social Benchmark, Theme C      10
 *   Overall corporate conduct          JUST Capital rank → percentile     30
 *   Diversity, equity & inclusion      As You Sow DEI score               25
 *
 * The score is the weighted average of the components the employer actually
 * has — missing sources are left out, not counted as zero — minus penalties
 * for the U.S. Department of Labor record at Bay Area sites (last 5 years):
 *
 *   wage-and-hour case       −4 each (max −16)
 *   repeat FLSA violator     −8
 *   serious OSHA violation   −2 each (max −12)
 *
 * Confidence reflects how much of the weight is backed by data.
 *
 * Adaptive route — every other employer, rated from whichever of these three
 * sources it has. It needs at least two; with fewer it isn't rated.
 *
 *   Source                                   Score (0–100)
 *   Social Benchmark (WBA via Wikirate)      Themes B/A/C, 25:10:10
 *   Where You Work Matters                   60 + 10 per Platinum badge (of 4)
 *   Labor record (U.S. Department of Labor)  85 if clean, −2.5 per penalty point above
 *
 * The sources count equally: each is worth 100 ÷ (sources the employer has)
 * points. With two sources each is worth 50, so Where You Work Matters gives
 * 30 for four Gold badges plus 5 per Platinum; with three, 20 plus 3.3.
 * Confidence is the source count: 2 is Medium, 3 is High.
 *
 * A Low-confidence employer (standard route) can't be rated above Strong,
 * whatever its score, and every rating says in words what backs it.
 *
 * Framework-free so the Employer Ratings page and the job feed share it.
 */

import { normalizeCompanyName } from "@/lib/scout/ratings";

export type RatingInputs = {
  fair_pay: number | null; // 0–100
  cultures: number | null; // 0–100
  honest: number | null; // 0–100
  just_capital_rank: number | null; // 1 = best
  as_you_sow: number | null; // 0–100
  dol_checked: boolean;
  dol_wage_cases: number;
  dol_repeat_violator: boolean;
  osha_serious_violations: number;
  /** Where You Work Matters badges; null when the employer isn't on the list. */
  wywm_gold?: number | null;
  wywm_platinum?: number | null;
};

/**
 * standard: JUST Capital and/or As You Sow, plus WBA, minus labor penalties.
 * adaptive: WBA, Where You Work Matters and the labor record, weighted equally.
 */
export type RatingRoute = "standard" | "adaptive";

export type Tier = "Exemplary" | "Strong" | "Fair" | "Mixed" | "Concerning";
export type Confidence = "High" | "Medium" | "Low";

export type EmployerRating = {
  score: number; // 0–100, rounded
  tier: Tier;
  confidence: Confidence;
  /** The confidence in words: how many sources, and which. */
  confidenceNote: string;
  components: { key: string; label: string; value: number; weight: number; detail: string }[];
  /** Points taken off after the average (standard route only). */
  penalties: { label: string; points: number }[];
  /** Short, human reasons for the tier — best first, then concerns. */
  highlights: string[];
  concerns: string[];
  /** Weighted average of the components, before penalties. */
  base: number;
  /** Share of the route's total weight backed by data, 0–1. */
  coverage: number;
  /** Measures this employer has no data for (left out of the average). */
  missing: { key: string; label: string; weight: number }[];
  /** Whether the Job Scout has looked up this employer's Department of Labor record. */
  laborChecked: boolean;
  /** True when Low confidence held an Exemplary-range score at Strong. */
  capped: boolean;
  route: RatingRoute;
  /** The independent sources behind the score, by name. */
  sources: string[];
  /** What the Department of Labor record shows, with the points each finding is worth. */
  laborFindings: { label: string; points: number }[];
};

/** JUST Capital ranks roughly the Russell 1000; rank 1 → 100, rank 1,000 → 0. */
export const JUST_CAPITAL_UNIVERSE = 1000;
export const justCapitalPercentile = (rank: number) =>
  Math.max(0, Math.min(100, 100 - ((rank - 1) / (JUST_CAPITAL_UNIVERSE - 1)) * 100));

const WEIGHTS = {
  fair_pay: 25,
  cultures: 10,
  honest: 10,
  just_capital: 30,
  as_you_sow: 25,
} as const;
const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

/** Every measure the standard route can use, in display order. */
const MEASURES: { key: keyof typeof WEIGHTS; label: string }[] = [
  { key: "fair_pay", label: "Fair pay & worker respect" },
  { key: "cultures", label: "Cultures & communities" },
  { key: "honest", label: "Honest & fair business" },
  { key: "just_capital", label: "Corporate conduct" },
  { key: "as_you_sow", label: "Diversity & inclusion" },
];

const ADAPTIVE_MEASURES: { key: "wba" | "wywm" | "labor"; label: string }[] = [
  { key: "wba", label: "Social Benchmark (WBA)" },
  { key: "wywm", label: "Where You Work Matters" },
  { key: "labor", label: "Labor record" },
];
/** Fewer sources than this and the adaptive route doesn't rate the employer. */
export const ADAPTIVE_MIN_SOURCES = 2;

/**
 * Where You Work Matters, 0–100: 60 for making the list (four Gold badges), +10
 * per Platinum (of 4). As points that's 30 + 5 per Platinum when the employer
 * has two sources (each worth 50).
 */
export const wywmScore = (platinum: number) => 60 + 10 * Math.max(0, Math.min(4, platinum));

/** Labor record on the adaptive route: a clean record scores 85, each penalty point costs 2.5. */
export const LABOR_CLEAN_SCORE = 85;
export const LABOR_POINT_COST = 2.5;

const SOURCE_NAMES = {
  wba: "World Benchmarking Alliance",
  just_capital: "JUST Capital",
  as_you_sow: "As You Sow",
  wywm: "Where You Work Matters",
  dol: "U.S. Department of Labor",
} as const;

export const TIERS: { tier: Tier; min: number; blurb: string }[] = [
  {
    tier: "Exemplary",
    min: 80,
    blurb: "Leads on pay, conduct and inclusion, with a clean labor record.",
  },
  { tier: "Strong", min: 65, blurb: "Above-average employer on most measures." },
  { tier: "Fair", min: 50, blurb: "Middle of the pack — solid in places, average in others." },
  { tier: "Mixed", min: 35, blurb: "Real weaknesses alongside some strengths." },
  { tier: "Concerning", min: 0, blurb: "Scores poorly or has a significant labor record." },
];

export const tierFor = (score: number): Tier => TIERS.find((t) => score >= t.min)!.tier;

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Department of Labor findings and their point values (empty when clean or unchecked). */
function laborFindings(i: RatingInputs): EmployerRating["laborFindings"] {
  if (!i.dol_checked) return [];
  const out: EmployerRating["laborFindings"] = [];
  if (i.dol_wage_cases > 0)
    out.push({
      label: plural(i.dol_wage_cases, "wage-and-hour case"),
      points: Math.min(16, i.dol_wage_cases * 4),
    });
  if (i.dol_repeat_violator) out.push({ label: "Repeat wage violator", points: 8 });
  if (i.osha_serious_violations > 0)
    out.push({
      label: plural(i.osha_serious_violations, "serious OSHA violation"),
      points: Math.min(12, i.osha_serious_violations * 2),
    });
  return out;
}

type Component = EmployerRating["components"][number];

/** Strengths and concerns, shared by both routes. Labor is described by its findings. */
function reasons(
  components: Component[],
  findings: EmployerRating["laborFindings"],
  i: RatingInputs,
) {
  const scored = components.filter((c) => c.key !== "labor");
  const highlights = scored
    .filter((c) => c.value >= 70)
    .sort((a, b) => b.value - a.value)
    .map((c) => `${c.label}: ${Math.round(c.value)}/100`);
  if (i.dol_checked && !findings.length) highlights.push("Clean Bay Area labor record");
  const concerns = [
    ...scored
      .filter((c) => c.value < 35)
      .sort((a, b) => a.value - b.value)
      .map((c) => `${c.label}: ${Math.round(c.value)}/100`),
    ...findings.map((f) => f.label),
  ];
  return { highlights, concerns };
}

const weightedAverage = (components: Component[]) => {
  const weight = components.reduce((s, c) => s + c.weight, 0);
  return { weight, base: components.reduce((s, c) => s + c.value * c.weight, 0) / weight };
};

/**
 * Returns null when the employer doesn't have enough data to rate: no scored
 * source on the standard route, fewer than two sources on the adaptive one.
 */
export function rateEmployer(i: RatingInputs): EmployerRating | null {
  return i.just_capital_rank !== null || i.as_you_sow !== null ? rateStandard(i) : rateAdaptive(i);
}

function rateStandard(i: RatingInputs): EmployerRating | null {
  const components: Component[] = [];
  const add = (
    key: string,
    label: string,
    value: number | null,
    weight: number,
    detail: string,
  ) => {
    if (value === null || Number.isNaN(value)) return;
    components.push({ key, label, value: clamp(value), weight, detail });
  };
  add(
    "fair_pay",
    "Fair pay & worker respect",
    i.fair_pay,
    WEIGHTS.fair_pay,
    "WBA Social Benchmark",
  );
  add("cultures", "Cultures & communities", i.cultures, WEIGHTS.cultures, "WBA Social Benchmark");
  add("honest", "Honest & fair business", i.honest, WEIGHTS.honest, "WBA Social Benchmark");
  if (i.just_capital_rank !== null)
    add(
      "just_capital",
      "Corporate conduct",
      justCapitalPercentile(i.just_capital_rank),
      WEIGHTS.just_capital,
      `JUST Capital #${i.just_capital_rank}`,
    );
  add("as_you_sow", "Diversity & inclusion", i.as_you_sow, WEIGHTS.as_you_sow, "As You Sow DEI");
  if (!components.length) return null;

  const { weight, base } = weightedAverage(components);
  const findings = laborFindings(i);
  const penalties = findings;
  const score = Math.round(clamp(base - penalties.reduce((s, p) => s + p.points, 0)));

  const coverage = weight / TOTAL_WEIGHT;
  const confidence: Confidence =
    coverage >= 0.7 && components.length >= 3 ? "High" : coverage >= 0.4 ? "Medium" : "Low";

  const have = new Set(components.map((c) => c.key));
  const sources: string[] = [
    have.has("fair_pay") || have.has("cultures") || have.has("honest") ? SOURCE_NAMES.wba : null,
    have.has("just_capital") ? SOURCE_NAMES.just_capital : null,
    have.has("as_you_sow") ? SOURCE_NAMES.as_you_sow : null,
    i.dol_checked ? SOURCE_NAMES.dol : null,
  ].filter((s): s is NonNullable<typeof s> => !!s);

  // One source isn't enough to call an employer Exemplary.
  const capped = confidence === "Low" && score >= 80;
  return {
    score,
    tier: capped ? "Strong" : tierFor(score),
    confidence,
    confidenceNote: `${confidence} confidence: ${plural(sources.length, "source")} (${sources.join(", ")}), covering ${Math.round(coverage * 100)}% of the rating's weight.`,
    components,
    penalties,
    ...reasons(components, findings, i),
    base,
    coverage,
    missing: MEASURES.filter((m) => !have.has(m.key)).map((m) => ({
      ...m,
      weight: WEIGHTS[m.key],
    })),
    laborChecked: i.dol_checked,
    capped,
    route: "standard",
    sources,
    laborFindings: findings,
  };
}

function rateAdaptive(i: RatingInputs): EmployerRating | null {
  const components: Component[] = [];

  const themes = (
    [
      ["Fair pay", i.fair_pay, WEIGHTS.fair_pay],
      ["Cultures", i.cultures, WEIGHTS.cultures],
      ["Honest business", i.honest, WEIGHTS.honest],
    ] as [string, number | null, number][]
  ).filter((t): t is [string, number, number] => t[1] !== null && !Number.isNaN(t[1]));
  if (themes.length) {
    const w = themes.reduce((s, t) => s + t[2], 0);
    components.push({
      key: "wba",
      label: "Social Benchmark (WBA)",
      value: clamp(themes.reduce((s, t) => s + clamp(t[1]) * t[2], 0) / w),
      weight: 0, // set below: the sources share 100 points equally
      detail: themes.map(([name, v]) => `${name} ${Math.round(v)}`).join(" · "),
    });
  }

  if (i.wywm_platinum !== null && i.wywm_platinum !== undefined) {
    components.push({
      key: "wywm",
      label: "Where You Work Matters",
      value: wywmScore(i.wywm_platinum),
      weight: 0,
      detail: `${i.wywm_platinum} Platinum · ${i.wywm_gold ?? 0} Gold badges`,
    });
  }

  const findings = laborFindings(i);
  if (i.dol_checked) {
    const points = findings.reduce((s, f) => s + f.points, 0);
    components.push({
      key: "labor",
      label: "Labor record",
      value: clamp(LABOR_CLEAN_SCORE - points * LABOR_POINT_COST),
      weight: 0,
      detail: points
        ? `${findings.map((f) => f.label).join(", ")} · −${points} points`
        : "Clean, last 5 years",
    });
  }

  if (components.length < ADAPTIVE_MIN_SOURCES) return null;

  // Every source counts equally: each is worth 100 / n points.
  const n = components.length;
  for (const c of components) c.weight = 100 / n;
  const { base } = weightedAverage(components);
  const score = Math.round(clamp(base));
  const confidence: Confidence = n >= 3 ? "High" : "Medium";
  const sources = components.map((c) =>
    c.key === "wba" ? SOURCE_NAMES.wba : c.key === "wywm" ? SOURCE_NAMES.wywm : SOURCE_NAMES.dol,
  );
  const have = new Set(components.map((c) => c.key));
  // Two sources minimum means this route is never Low confidence, so never capped.
  const capped = false;

  return {
    score,
    tier: tierFor(score),
    confidence,
    confidenceNote: `${confidence} confidence: ${n} of ${ADAPTIVE_MEASURES.length} possible sources (${sources.join(", ")}), each worth ${Math.round((100 / n) * 10) / 10} of the 100 points.`,
    components,
    penalties: [],
    ...reasons(components, findings, i),
    base,
    coverage: n / ADAPTIVE_MEASURES.length,
    // What a missing source would be worth if the employer had it.
    missing: ADAPTIVE_MEASURES.filter((m) => !have.has(m.key)).map((m) => ({
      ...m,
      weight: Math.round((100 / (n + 1)) * 10) / 10,
    })),
    laborChecked: i.dol_checked,
    capped,
    route: "adaptive",
    sources,
    laborFindings: findings,
  };
}

// ---------------------------------------------------------------------------
// Assembling inputs from the database bundle (see employer_rating_inputs())
// ---------------------------------------------------------------------------

export type RatingBundle = {
  ratings: {
    source: string;
    company_name: string;
    normalized_name: string;
    rank: number | null;
    score: number | null;
  }[];
  ethics: {
    company_key: string;
    company_name: string;
    fair_pay_score: number | null;
    cultures_score: number | null;
    honest_score: number | null;
    dol_checked: boolean;
    dol_wage_cases: number;
    dol_repeat_violator: boolean;
    osha_serious_violations: number;
    wba_year: number | null;
  }[];
  /** Where You Work Matters list; missing before migration 20261005000005. */
  wywm?: { company_name: string; normalized_name: string; gold: number; platinum: number }[];
  aliases: { name: string; rating_name: string }[];
  jobs: { company: string; n: number }[];
};

export type RatedEmployer = {
  key: string;
  name: string;
  openJobs: number;
  rating: EmployerRating | null;
  /** Position among rated employers hiring on Savant, 1 = best; null otherwise. */
  hiringRank: number | null;
  /** Position among every rated employer, 1 = best; null when unrated. */
  overallRank: number | null;
  /** Year of the World Benchmarking Alliance assessment behind the WBA measures, if any. */
  wbaYear: number | null;
};

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/**
 * Every employer we know about — hiring on Savant, checked by the Job Scout,
 * on a published ranking or on Where You Work Matters — with its rating.
 * Sorted best first; unrated employers last.
 */
export function buildEmployerIndex(b: RatingBundle): Map<string, RatedEmployer> {
  const aliasOf = new Map(
    b.aliases.map((a) => [normalizeCompanyName(a.name), normalizeCompanyName(a.rating_name)]),
  );
  const rankings = new Map<string, { just: number | null; ays: number | null; name: string }>();
  for (const r of b.ratings) {
    const cur = rankings.get(r.normalized_name) ?? { just: null, ays: null, name: r.company_name };
    if (r.source === "just_capital") cur.just = num(r.rank);
    if (r.source === "as_you_sow") cur.ays = num(r.score);
    rankings.set(r.normalized_name, cur);
  }
  const ethics = new Map(b.ethics.map((e) => [e.company_key, e]));
  const wywm = new Map((b.wywm ?? []).map((w) => [w.normalized_name, w]));
  const jobs = new Map<string, { name: string; n: number }>();
  for (const j of b.jobs) {
    const k = normalizeCompanyName(j.company);
    if (!k) continue;
    const cur = jobs.get(k);
    jobs.set(k, { name: cur?.name ?? j.company, n: (cur?.n ?? 0) + Number(j.n) });
  }

  const keys = new Set([...jobs.keys(), ...ethics.keys(), ...rankings.keys(), ...wywm.keys()]);
  // A ranking filed under a company's alias belongs to the company itself.
  for (const alias of aliasOf.values())
    if (!jobs.has(alias) && !ethics.has(alias)) keys.delete(alias);

  const out: RatedEmployer[] = [];
  for (const key of keys) {
    if (!key) continue;
    const e = ethics.get(key);
    const alias = aliasOf.get(key);
    const r = rankings.get(alias ?? key) ?? rankings.get(key);
    const w = (alias ? wywm.get(alias) : undefined) ?? wywm.get(key);
    const rating = rateEmployer({
      fair_pay: num(e?.fair_pay_score),
      cultures: num(e?.cultures_score),
      honest: num(e?.honest_score),
      just_capital_rank: r?.just ?? null,
      as_you_sow: r?.ays ?? null,
      dol_checked: !!e?.dol_checked,
      dol_wage_cases: e?.dol_wage_cases ?? 0,
      dol_repeat_violator: !!e?.dol_repeat_violator,
      osha_serious_violations: e?.osha_serious_violations ?? 0,
      wywm_gold: num(w?.gold),
      wywm_platinum: num(w?.platinum),
    });
    out.push({
      key,
      name: jobs.get(key)?.name ?? e?.company_name ?? r?.name ?? w?.company_name ?? key,
      openJobs: jobs.get(key)?.n ?? 0,
      rating,
      hiringRank: null,
      overallRank: null,
      wbaYear: num(e?.wba_year),
    });
  }

  // Tier first (a capped Low-confidence score doesn't outrank a better-backed tier), then score.
  const tierRank = (e: RatedEmployer) =>
    e.rating ? TIERS.findIndex((t) => t.tier === e.rating!.tier) : TIERS.length;
  out.sort(
    (a, b) =>
      tierRank(a) - tierRank(b) ||
      (b.rating?.score ?? -1) - (a.rating?.score ?? -1) ||
      b.openJobs - a.openJobs ||
      a.name.localeCompare(b.name),
  );
  let rank = 0;
  let overall = 0;
  for (const e of out) {
    if (!e.rating) continue;
    e.overallRank = ++overall;
    if (e.openJobs > 0) e.hiringRank = ++rank;
  }
  return new Map(out.map((e) => [e.key, e]));
}

export const employerKey = (name: string) => normalizeCompanyName(name);

/** URL slug for an employer: its page is /employer-ratings/<slug>. */
export const employerAnchor = (key: string) => key.replace(/\s+/g, "-");

/** The employer whose page slug this is, if we know it. */
export const employerBySlug = (index: Map<string, RatedEmployer>, slug: string) =>
  index.get(slug.replace(/-/g, " ")) ??
  [...index.values()].find((e) => employerAnchor(e.key) === slug) ??
  null;
