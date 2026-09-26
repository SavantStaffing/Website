import { z } from "zod";
import type { NormalizedJob, RawJob } from "./types.ts";

/**
 * Schema validation + the "Passing Score from Auditor" gate.
 *
 * Each raw posting is checked against the minimum the site needs to show it.
 * A company's batch is only ingested when enough of it passes — a board that
 * suddenly returns mostly-broken rows usually means the ATS changed its
 * response shape, and ingesting it would pollute the feed.
 */
export const rawJobSchema = z.object({
  external_id: z.string().min(1).max(200),
  title: z.string().trim().min(2).max(300),
  company_name: z.string().trim().min(1).max(200),
  apply_url: z.string().url().max(2000),
  location: z.string().max(500).nullable(),
  description: z.string().max(200_000).nullable(),
  posted_at: z.string().datetime({ offset: true }).nullable(),
});

export const AUDIT_PASS_THRESHOLD = 0.8;

export type AuditResult = {
  valid: RawJob[];
  failures: { external_id: string; issues: string[] }[];
  passRate: number;
  passed: boolean;
};

export function audit(jobs: RawJob[], threshold = AUDIT_PASS_THRESHOLD): AuditResult {
  const valid: RawJob[] = [];
  const failures: AuditResult["failures"] = [];
  for (const job of jobs) {
    const r = rawJobSchema.safeParse(job);
    if (r.success) valid.push(job);
    else
      failures.push({
        external_id: job.external_id ?? "?",
        issues: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
  }
  // An empty board is a legitimate state (company not hiring), not a failure.
  const passRate = jobs.length === 0 ? 1 : valid.length / jobs.length;
  return { valid, failures, passRate, passed: passRate >= threshold };
}

const FILL_FIELDS = [
  "location",
  "description",
  "department",
  "employment_type",
  "posted_at",
  "industry",
  "naics_code",
] as const satisfies readonly (keyof NormalizedJob)[];

/** Field-level fill rates (0–1) per source, for the diagnostics page. */
export function fillRates(jobs: NormalizedJob[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (jobs.length === 0) return out;
  for (const f of FILL_FIELDS) {
    const filled = jobs.filter((j) => j[f] !== null && j[f] !== "").length;
    out[f] = Math.round((filled / jobs.length) * 1000) / 1000;
  }
  return out;
}
