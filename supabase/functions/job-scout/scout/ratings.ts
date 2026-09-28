// Generated from src/lib/scout/ratings.ts by scripts/build-scout-function.mjs. Do not edit.
/**
 * "Passing Score from Auditor": the employer-ethics gate a company must pass
 * before the Job Scout ingests its postings.
 *
 *   JUST Capital rankings  — passes at rank ≤ just_capital_max_rank (default 50)
 *   As You Sow DEI scores  — passes at score ≥ as_you_sow_min_score (default 40)
 *
 * A company that appears on a list and misses its cutoff is gated out. With
 * mode "all" (default) it must pass every list it appears on; with "any",
 * passing one is enough. A company on neither list isn't judged here — it
 * goes through the normal filters (validation, ghost detection, ranking).
 *
 * Framework-free so the pipeline, the admin UI and scripts share it.
 */

export const RATING_SOURCES = ["just_capital", "as_you_sow"] as const;
export type RatingSource = (typeof RATING_SOURCES)[number];

export const RATING_SOURCE_LABEL: Record<RatingSource, string> = {
  just_capital: "JUST Capital",
  as_you_sow: "As You Sow DEI",
};

export type CompanyRating = {
  source: RatingSource;
  company_name: string;
  normalized_name: string;
  rank: number | null; // JUST Capital
  score: number | null; // As You Sow (0–100)
};

export type RatingsConfig = {
  enabled: boolean;
  just_capital_max_rank: number;
  as_you_sow_min_score: number;
  mode: "all" | "any";
};

export const DEFAULT_RATINGS_CONFIG: RatingsConfig = {
  enabled: true,
  just_capital_max_rank: 50,
  as_you_sow_min_score: 40,
  mode: "all",
};

export type RatingCheck = { source: RatingSource; label: string; passed: boolean; value: string };

export type RatingVerdict = {
  verdict: "pass" | "fail" | "unlisted" | "override_pass" | "override_fail";
  checks: RatingCheck[];
  /** Short labels shown on the company's jobs when it passes, e.g. "JUST Capital #16". */
  badges: string[];
  summary: string;
};

// Legal-form and filler words that differ between lists ("Salesforce.com Inc"
// vs "SALESFORCE, INC", "The Walt Disney Company" vs "WALT DISNEY").
const SUFFIXES = new Set([
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "company",
  "companies",
  "ltd",
  "limited",
  "llc",
  "plc",
  "lp",
  "nv",
  "sa",
  "ag",
  "pbc",
  "holdings",
  "holding",
  "group",
  "the",
  "de",
  "ca",
]);

export function normalizeCompanyName(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\.com\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && !SUFFIXES.has(w));
  while (words.length > 1 && words[words.length - 1] === "and") words.pop();
  while (words.length > 1 && words[0] === "and") words.shift();
  return words.join(" ");
}

/** Index ratings by normalized name for fast lookup. */
export function indexRatings(ratings: CompanyRating[]): Map<string, CompanyRating[]> {
  const map = new Map<string, CompanyRating[]>();
  for (const r of ratings) map.set(r.normalized_name, [...(map.get(r.normalized_name) ?? []), r]);
  return map;
}

export function evaluateCompany(
  name: string,
  index: Map<string, CompanyRating[]>,
  config: RatingsConfig,
  opts: { alias?: string | null; override?: "pass" | "fail" | null } = {},
): RatingVerdict {
  const found = index.get(normalizeCompanyName(opts.alias || name)) ?? [];
  const checks: RatingCheck[] = [];
  for (const r of found) {
    if (r.source === "just_capital" && r.rank !== null) {
      checks.push({
        source: r.source,
        label: `JUST Capital #${r.rank}`,
        value: `#${r.rank}`,
        passed: r.rank <= config.just_capital_max_rank,
      });
    } else if (r.source === "as_you_sow" && r.score !== null) {
      checks.push({
        source: r.source,
        label: `As You Sow DEI ${r.score}%`,
        value: `${r.score}%`,
        passed: r.score >= config.as_you_sow_min_score,
      });
    }
  }

  const passedLabels = checks.filter((c) => c.passed).map((c) => c.label);
  const describe = checks
    .map((c) => `${c.label} (${c.passed ? "passes" : "below cutoff"})`)
    .join(", ");

  if (opts.override === "pass")
    return {
      verdict: "override_pass",
      checks,
      badges: passedLabels,
      summary: "Admin override: always include",
    };
  if (opts.override === "fail")
    return {
      verdict: "override_fail",
      checks,
      badges: [],
      summary: "Admin override: always exclude",
    };
  if (!config.enabled || checks.length === 0)
    return {
      verdict: "unlisted",
      checks,
      badges: [],
      summary: checks.length ? describe : "Not on either list",
    };

  const passed =
    config.mode === "all" ? checks.every((c) => c.passed) : checks.some((c) => c.passed);
  return passed
    ? { verdict: "pass", checks, badges: passedLabels, summary: describe }
    : { verdict: "fail", checks, badges: [], summary: describe };
}

export const isGatedOut = (v: RatingVerdict) =>
  v.verdict === "fail" || v.verdict === "override_fail";

// ---------------------------------------------------------------- CSV import

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/^\uFEFF/, ""),
  );
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

/**
 * Turn an uploaded CSV into ratings. Accepts the As You Sow export
 * (name, score, …) and a JUST Capital list (rank, name). Returns the rows
 * plus any lines that couldn't be read.
 */
export function ratingsFromCsv(
  source: RatingSource,
  text: string,
): { rows: CompanyRating[]; skipped: string[] } {
  const rows: CompanyRating[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const r of parseCsv(text)) {
    const name = r.name ?? r.company ?? r.company_name ?? "";
    const num = Number(
      (source === "just_capital" ? (r.rank ?? r.overall_rank) : r.score)?.replace("%", ""),
    );
    const normalized = normalizeCompanyName(name);
    if (!name || !normalized || !Number.isFinite(num)) {
      skipped.push(name || JSON.stringify(r));
      continue;
    }
    if (seen.has(normalized)) continue; // first occurrence wins (best rank / listed order)
    seen.add(normalized);
    rows.push({
      source,
      company_name: name,
      normalized_name: normalized,
      rank: source === "just_capital" ? num : null,
      score: source === "as_you_sow" ? num : null,
    });
  }
  return { rows, skipped };
}
