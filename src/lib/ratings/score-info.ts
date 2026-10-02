/**
 * Plain-language explanations for every score Savant shows, used by the
 * hover/tap cards (components/ratings/ScoreInfo.tsx). Keep in step with the
 * formula in employer-rating.ts and the sources the Job Scout collects.
 */
import { JUST_CAPITAL_UNIVERSE, TIERS, type Confidence, type Tier } from "./employer-rating";

export type ScoreInfoEntry = {
  title: string;
  /** One or two sentences: what this measures and what a high number means. */
  what: string;
  /** How to read the number. */
  scale?: string;
  source?: { name: string; url: string };
};

const WBA = {
  name: "World Benchmarking Alliance (via Wikirate)",
  url: "https://www.worldbenchmarkingalliance.org/social-benchmark/",
};

export const SCORE_INFO = {
  savant: {
    title: "Savant Employer Rating",
    what: "One score for how well an employer treats its people, combining every independent source we have: pay and worker treatment, corporate conduct, diversity and inclusion, and its recent U.S. Department of Labor record.",
    scale:
      "0–100, higher is better. Sources an employer isn't covered by are left out rather than counted as zero; wage and safety violations subtract points.",
  },
  fair_pay: {
    title: "Fair pay & worker respect",
    what: "How well the company provides decent work: living wages, working hours, health and safety, and workers' voice.",
    scale: "0–100, higher is better. Counts for 25 of the 100 rating points.",
    source: WBA,
  },
  cultures: {
    title: "Respect for cultures & communities",
    what: "How well the company respects human rights across its operations and supply chain, and the communities it affects.",
    scale: "0–100, higher is better. Counts for 10 of the 100 rating points.",
    source: WBA,
  },
  honest: {
    title: "Honest & fair business",
    what: "How ethically the company behaves: anti-corruption, responsible tax and lobbying, and protecting personal data.",
    scale: "0–100, higher is better. Counts for 10 of the 100 rating points.",
    source: WBA,
  },
  just_capital: {
    title: "Corporate conduct (JUST Capital)",
    what: "JUST Capital ranks large U.S. companies on what Americans say matters most: paying a fair wage, treating workers well, and acting ethically toward customers and communities.",
    scale: `A rank where #1 is best, out of about ${JUST_CAPITAL_UNIVERSE.toLocaleString()} companies. We turn it into 0–100 (rank #1 = 100). Counts for 30 of the 100 rating points.`,
    source: { name: "JUST Capital", url: "https://justcapital.com/rankings/" },
  },
  as_you_sow: {
    title: "Diversity & inclusion (As You Sow)",
    what: "As You Sow scores how transparent and effective a company's workplace diversity, equity and inclusion practices are, from its public disclosures.",
    scale: "0–100%, higher is better. Counts for 25 of the 100 rating points.",
    source: { name: "As You Sow", url: "https://www.asyousow.org/" },
  },
  labor_record: {
    title: "Labor record",
    what: "U.S. Department of Labor records for the employer's Bay Area workplaces over the last five years: wage-and-hour cases and serious OSHA safety violations.",
    scale:
      "Subtracts from the rating: −4 per wage case (up to −16), −8 for a repeat wage violator, −2 per serious OSHA violation (up to −12).",
    source: { name: "U.S. Department of Labor", url: "https://enforcedata.dol.gov/" },
  },
} satisfies Record<string, ScoreInfoEntry>;

export type ScoreKey = keyof typeof SCORE_INFO;

/** Rating component keys (employer-rating.ts) → glossary entries. */
export const COMPONENT_INFO: Record<string, ScoreKey> = {
  fair_pay: "fair_pay",
  cultures: "cultures",
  honest: "honest",
  just_capital: "just_capital",
  as_you_sow: "as_you_sow",
};

export const TIER_RANGES: { tier: Tier; range: string; blurb: string }[] = TIERS.map((t, i) => ({
  tier: t.tier,
  range: i === 0 ? `${t.min}–100` : `${t.min}–${TIERS[i - 1].min - 1}`,
  blurb: t.blurb,
}));

export const CONFIDENCE_INFO: Record<Confidence, string> = {
  High: "Backed by most of our sources (at least 70% of the rating's weight, from three or more).",
  Medium: "Backed by some of our sources. A good indication, not the full picture.",
  Low: "Based on a single source or very little data. Treat it as a first look; it can't rate above Strong.",
};

/**
 * Which glossary entry explains an employer badge from the ratings gate
 * (src/lib/scout/ratings.ts: "JUST Capital #12", "As You Sow DEI 62%").
 */
export function badgeInfo(badge: string): ScoreKey | null {
  if (/^JUST Capital/i.test(badge)) return "just_capital";
  if (/^As You Sow/i.test(badge)) return "as_you_sow";
  return null;
}
