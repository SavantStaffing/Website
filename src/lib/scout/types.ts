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

export type JobSource = AtsPlatform | BoardSource | "manual";

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
