import type { CompanyType, JobTrack, PayRange } from "./track.ts";

/**
 * Shared shapes for the Job Scout pipeline. Everything in src/lib/scout uses
 * relative imports and no framework code, so the pipeline can be exercised
 * directly with `node` (see scripts/scout-smoke.ts) as well as from the app.
 */

export const ATS_PLATFORMS = [
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "workable",
  "workday",
  "icims",
  // Not an ATS: a careers site read through its schema.org JobPosting markup.
  "jsonld",
  // Unique scanners for staffing-agency boards (staffing-boards.ts).
  "avionte",
  "smpl",
  "partners",
  // Enterprise ATS platforms whose lists load in the browser (enterprise-ats.ts).
  "successfactors",
  "phenom",
  "dayforce",
  // Careers sites with a public JSON search API (search-apis.ts).
  "eightfold",
  "oracle",
  "ultipro",
  "amazon",
  // Avature careers sites, read like iCIMS (jobposting.ts).
  "avature",
] as const;
export type AtsPlatform = (typeof ATS_PLATFORMS)[number];

/** Job-board sources reached through the JobSpy service (see services/jobspy). */
export const BOARD_SOURCES = [
  "linkedin",
  "indeed",
  "google",
  "glassdoor",
  "zip_recruiter",
] as const;
export type BoardSource = (typeof BOARD_SOURCES)[number];

/** Official job-aggregator APIs, searched on a request budget (aggregators.ts). */
export const AGGREGATOR_SOURCES = ["adzuna", "jooble"] as const;
export type AggregatorSource = (typeof AGGREGATOR_SOURCES)[number];

export type JobSource = AtsPlatform | BoardSource | AggregatorSource | "manual";

export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "temporary",
  "contract",
  "internship",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full time",
  part_time: "Part time",
  temporary: "Temporary",
  contract: "Contract",
  internship: "Internship",
};

export type Seniority = "intern" | "entry" | "mid" | "senior" | "lead" | "executive";

/** A row from scout_companies — the "config table of companies with ATS endpoints". */
export type ScoutCompany = {
  id: string;
  name: string;
  careers_url: string | null;
  ats: AtsPlatform | null;
  ats_token: string | null;
  industry: string | null;
  naics_code: string | null;
  enabled: boolean;
  /** Name to look up in the ratings lists when it differs from `name`. */
  rating_name?: string | null;
  /** Admin override of the ratings gate. */
  rating_override?: "pass" | "fail" | null;
  /** Staffing agencies post both hourly and professional roles for their clients. */
  company_type?: CompanyType | null;
};

/** What an ATS adapter returns, before validation. Loosely typed on purpose. */
export type RawJob = {
  source: JobSource;
  external_id: string;
  title: string;
  company_name: string;
  location: string | null;
  description: string | null;
  apply_url: string | null;
  department: string | null;
  employment_type_raw: string | null;
  remote_hint: boolean | null;
  posted_at: string | null;
  industry_raw?: string | null;
  /** Posted pay, when the source publishes it. */
  pay?: PayRange | null;
  /** The source itself filtered to U.S. postings (e.g. a Workday country facet). */
  country_hint?: "US" | null;
};

/** A job after validation + refinement, ready to upsert into public.jobs. */
export type NormalizedJob = {
  source: JobSource;
  external_id: string;
  scout_company_id: string | null;
  title: string;
  company_name: string;
  location: string | null;
  description: string | null;
  apply_url: string | null;
  department: string | null;
  industry: string | null;
  naics_code: string | null;
  employment_type: EmploymentType | null;
  type: string | null; // legacy display column on jobs
  seniority: Seniority;
  remote: boolean;
  posted_at: string | null;
  employer_badges: string[];
  /** Which feed it lands in: temp & hourly or professional (track.ts). */
  track: JobTrack;
  track_reasons: string[];
  pay_min: number | null;
  pay_max: number | null;
  pay_unit: PayRange["unit"] | null;
  /** Employer ethics scores, 0–100, from ethics.ts (null = not benchmarked). */
  fair_pay_score: number | null;
  cultures_score: number | null;
  honest_score: number | null;
  /** WBA year + Department of Labor / OSHA counts behind the scores, for display. */
  ethics_summary: Record<string, unknown> | null;
  fingerprint: string;
  ghost_score: number;
  ghost_reasons: string[];
  status: "active" | "flagged";
};

export type SourceMetrics = {
  source: string;
  requests: number;
  successes: number;
  rate_limited: number;
  status_counts: Record<string, number>;
  avg_response_ms: number | null;
  p95_response_ms: number | null;
  proxy: string | null;
  jobs_ingested: number;
  schema_failures: number;
  field_fill_rates: Record<string, number>;
};
