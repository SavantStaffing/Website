/**
 * Savant Employer Rating: one 0–100 score and a plain-language tier per
 * employer, combining every independent source the Job Scout collects.
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
 * Confidence reflects how much of the weight is backed by data, so a score
 * built from one source is labelled as such rather than presented as settled;
 * a Low-confidence employer can't be rated above Strong, whatever its score.
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
};

export type Tier = "Exemplary" | "Strong" | "Fair" | "Mixed" | "Concerning";
export type Confidence = "High" | "Medium" | "Low";

export type EmployerRating = {
  score: number; // 0–100, rounded
  tier: Tier;
  confidence: Confidence;
  components: { key: string; label: string; value: number; weight: number; detail: string }[];
  penalties: { label: string; points: number }[];
  /** Short, human reasons for the tier — best first, then concerns. */
  highlights: string[];
  concerns: string[];
  /** Weighted average of the components, before the labor-record penalties. */
  base: number;
  /** Share of the rating's total weight backed by data, 0–1. */
  coverage: number;
  /** Measures this employer has no data for (left out of the average). */
  missing: { key: string; label: string; weight: number }[];
  /** Whether the Job Scout has looked up this employer's Department of Labor record. */
  laborChecked: boolean;
  /** True when Low confidence held an Exemplary-range score at Strong. */
  capped: boolean;
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

/** Every measure the rating can use, in display order. */
const MEASURES: { key: keyof typeof WEIGHTS; label: string }[] = [
  { key: "fair_pay", label: "Fair pay & worker respect" },
  { key: "cultures", label: "Cultures & communities" },
  { key: "honest", label: "Honest & fair business" },
  { key: "just_capital", label: "Corporate conduct" },
  { key: "as_you_sow", label: "Diversity & inclusion" },
];

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

/** Returns null when there's no scored source at all — the employer isn't rated. */
export function rateEmployer(i: RatingInputs): EmployerRating | null {
  const components: EmployerRating["components"] = [];
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

  const weight = components.reduce((s, c) => s + c.weight, 0);
  const base = components.reduce((s, c) => s + c.value * c.weight, 0) / weight;

  const penalties: EmployerRating["penalties"] = [];
  if (i.dol_checked) {
    if (i.dol_wage_cases > 0)
      penalties.push({
        label: `${i.dol_wage_cases} wage-and-hour case${i.dol_wage_cases === 1 ? "" : "s"}`,
        points: Math.min(16, i.dol_wage_cases * 4),
      });
    if (i.dol_repeat_violator) penalties.push({ label: "Repeat wage violator", points: 8 });
    if (i.osha_serious_violations > 0)
      penalties.push({
        label: `${i.osha_serious_violations} serious OSHA violation${i.osha_serious_violations === 1 ? "" : "s"}`,
        points: Math.min(12, i.osha_serious_violations * 2),
      });
  }
  const score = Math.round(clamp(base - penalties.reduce((s, p) => s + p.points, 0)));

  const coverage = weight / TOTAL_WEIGHT;
  const confidence: Confidence =
    coverage >= 0.7 && components.length >= 3 ? "High" : coverage >= 0.4 ? "Medium" : "Low";

  const highlights = components
    .filter((c) => c.value >= 70)
    .sort((a, b) => b.value - a.value)
    .map((c) => `${c.label}: ${Math.round(c.value)}/100`);
  if (i.dol_checked && !penalties.length) highlights.push("Clean Bay Area labor record");
  const concerns = [
    ...components
      .filter((c) => c.value < 35)
      .sort((a, b) => a.value - b.value)
      .map((c) => `${c.label}: ${Math.round(c.value)}/100`),
    ...penalties.map((p) => p.label),
  ];

  // One source isn't enough to call an employer Exemplary.
  const capped = confidence === "Low" && score >= 80;
  const tier = capped ? "Strong" : tierFor(score);

  const have = new Set(components.map((c) => c.key));
  const missing = MEASURES.filter((m) => !have.has(m.key)).map((m) => ({
    ...m,
    weight: WEIGHTS[m.key],
  }));

  return {
    score,
    tier,
    confidence,
    components,
    penalties,
    highlights,
    concerns,
    base,
    coverage,
    missing,
    laborChecked: i.dol_checked,
    capped,
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
 * or on a published ranking — with its rating. Sorted best first; unrated
 * employers last.
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
  const jobs = new Map<string, { name: string; n: number }>();
  for (const j of b.jobs) {
    const k = normalizeCompanyName(j.company);
    if (!k) continue;
    const cur = jobs.get(k);
    jobs.set(k, { name: cur?.name ?? j.company, n: (cur?.n ?? 0) + Number(j.n) });
  }

  const keys = new Set([...jobs.keys(), ...ethics.keys(), ...rankings.keys()]);
  // A ranking filed under a company's alias belongs to the company itself.
  for (const alias of aliasOf.values())
    if (!jobs.has(alias) && !ethics.has(alias)) keys.delete(alias);

  const out: RatedEmployer[] = [];
  for (const key of keys) {
    if (!key) continue;
    const e = ethics.get(key);
    const r = rankings.get(aliasOf.get(key) ?? key) ?? rankings.get(key);
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
    });
    out.push({
      key,
      name: jobs.get(key)?.name ?? e?.company_name ?? r?.name ?? key,
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
