import { detectAts } from "./detect.ts";
import { scoreGhost, GHOST_FLAG_THRESHOLD } from "./ghost.ts";
import { HttpError, MetricsRecorder, mapLimit } from "./http.ts";
import {
  cleanTitle,
  employmentTypeLabel,
  fingerprint,
  inferSeniority,
  isRemote,
  naicsFromIndustry,
  normalizeEmploymentType,
} from "./refine.ts";
import {
  evaluateCompany,
  indexRatings,
  isGatedOut,
  type CompanyRating,
  type RatingsConfig,
} from "./ratings.ts";
import { ATS_ADAPTERS, jobspy } from "./sources.ts";
import { classifyTrack } from "./track.ts";
import type { BoardSource, NormalizedJob, RawJob, ScoutCompany, SourceMetrics } from "./types.ts";
import { audit, AUDIT_PASS_THRESHOLD, fillRates } from "./validate.ts";
import { scanCompanySite } from "./webscan.ts";

/**
 * The Job Scout Agent, end to end:
 *
 *   Admin input / schedule
 *     → Passing Score from Auditor: JUST Capital / As You Sow gate (ratings.ts)
 *     → Company Web Scan (identify the ATS when the config row doesn't know it yet)
 *     → Call endpoint → Map into site schema               (sources.ts)
 *     → Data-quality check (schema validation)             (validate.ts)
 *     → Refine parameters: position, industry/NAICS, date, location, type (refine.ts)
 *     → Feed track: temp & hourly vs professional          (track.ts)
 *     → Ghost Job Detector v2                              (ghost.ts)
 *     → Normalization + upsert, close postings that disappeared
 *     → per-source diagnostics
 *
 * A careers site nothing can read (no ATS we support, no JobPosting markup,
 * no job sitemap) is recorded in the unique-scanner registry, with the
 * platform it uses when we recognize it, so it can get a custom scanner.
 *
 * Storage is behind `ScoutStore` so the same pipeline runs against Supabase
 * in the app and against an in-memory store in scripts/scout-smoke.ts.
 */

export type ExistingJob = {
  source: string;
  external_id: string;
  first_seen_at: string;
  ghost_override: boolean;
};

export type ScoutSettings = {
  enabled_boards: BoardSource[];
  board_queries: { search_term: string; location?: string }[];
  ghost_threshold: number;
  audit_threshold: number;
};

export const DEFAULT_SETTINGS: ScoutSettings = {
  enabled_boards: [],
  board_queries: [],
  ghost_threshold: GHOST_FLAG_THRESHOLD,
  audit_threshold: AUDIT_PASS_THRESHOLD,
};

export type CompanyPatch = Partial<
  Pick<ScoutCompany, "ats" | "ats_token"> & {
    last_status: string;
    last_error: string | null;
    last_scanned_at: string;
    last_pass_rate: number;
    last_rating: string | null;
  }
>;

/** A careers site the scout can't read — a row in unique_scanner_sites. */
export type UniqueScannerSite = {
  scout_company_id: string;
  name: string;
  site_url: string;
  platform: string | null;
  reason: string;
};

export interface ScoutStore {
  listCompanies(ids?: string[]): Promise<ScoutCompany[]>;
  updateCompany(id: string, patch: CompanyPatch): Promise<void>;
  existingJobs(source: string, externalIds: string[]): Promise<ExistingJob[]>;
  /** Count of live postings per fingerprint, excluding the given (source, external_id) keys. */
  fingerprintCounts(fingerprints: string[], exclude: Set<string>): Promise<Map<string, number>>;
  upsertJobs(
    rows: (NormalizedJob & { last_seen_at: string })[],
  ): Promise<{ inserted: number; updated: number }>;
  /** Close a company's postings not seen since `seenSince` (they were taken down). */
  closeUnseen(
    filter: { scout_company_id?: string; sources?: string[] },
    seenSince: string,
  ): Promise<number>;
  /** Add (or refresh) a site in the unique-scanner registry. */
  registerUniqueScanner(site: UniqueScannerSite): Promise<void>;
  /** A registered company's jobs can be read now: mark its registry row supported. */
  resolveUniqueScanner(companyId: string): Promise<void>;
}

export type CompanyOutcome = {
  company: string;
  status: "ok" | "no_ats" | "http_error" | "failed_audit" | "failed_rating" | "error";
  ats: string | null;
  found: number;
  passRate: number;
  inserted: number;
  updated: number;
  rejected: number;
  flagged: number;
  closed: number;
  /** Ratings-gate verdict, e.g. "JUST Capital #16 (passes), As You Sow DEI 44% (passes)". */
  rating?: string;
  error?: string;
};

export type RunSummary = {
  outcomes: CompanyOutcome[];
  metrics: SourceMetrics[];
  totals: {
    companies_scanned: number;
    jobs_found: number;
    jobs_inserted: number;
    jobs_updated: number;
    jobs_rejected: number;
    jobs_flagged: number;
    jobs_closed: number;
  };
  status: "succeeded" | "partial" | "failed";
};

type SourceTally = { ingested: NormalizedJob[]; schemaFailures: number };

export async function runScout(
  store: ScoutStore,
  opts: {
    companyIds?: string[];
    settings?: ScoutSettings;
    jobspyUrl?: string | null;
    jobspyToken?: string | null;
    /** JUST Capital / As You Sow lists + cutoffs. Omit to skip the gate. */
    ratings?: { config: RatingsConfig; list: CompanyRating[] };
    /** Validate + score but don't write jobs (used by the admin "preview" button). */
    dryRun?: boolean;
    now?: Date;
  } = {},
): Promise<RunSummary> {
  const settings = opts.settings ?? DEFAULT_SETTINGS;
  const now = opts.now ?? new Date();
  const runStartedAt = now.toISOString();
  const rec = new MetricsRecorder();
  const tallies = new Map<string, SourceTally>();
  const tally = (source: string) => {
    const t = tallies.get(source) ?? { ingested: [], schemaFailures: 0 };
    tallies.set(source, t);
    return t;
  };

  const ratingsIndex = opts.ratings ? indexRatings(opts.ratings.list) : null;
  const rate = (name: string, company?: ScoutCompany) =>
    opts.ratings && ratingsIndex
      ? evaluateCompany(name, ratingsIndex, opts.ratings.config, {
          alias: company?.rating_name,
          override: company?.rating_override,
        })
      : null;

  const companies = (await store.listCompanies(opts.companyIds)).filter(
    (c) => c.enabled || opts.companyIds?.includes(c.id),
  );

  const outcomes = await mapLimit(companies, 4, async (company): Promise<CompanyOutcome> => {
    const base: CompanyOutcome = {
      company: company.name,
      status: "ok",
      ats: company.ats,
      found: 0,
      passRate: 1,
      inserted: 0,
      updated: 0,
      rejected: 0,
      flagged: 0,
      closed: 0,
    };
    try {
      // --- Passing Score from Auditor: a company that misses its JUST Capital /
      // As You Sow cutoff is never fetched, and its live postings are closed.
      const verdict = rate(company.name, company);
      if (verdict && isGatedOut(verdict)) {
        const closed = opts.dryRun
          ? 0
          : await store.closeUnseen({ scout_company_id: company.id }, runStartedAt);
        if (!opts.dryRun)
          await store.updateCompany(company.id, {
            last_status: "failed_rating",
            last_error: null,
            last_rating: verdict.summary,
            last_scanned_at: runStartedAt,
          });
        return { ...base, status: "failed_rating", closed, rating: verdict.summary };
      }
      const badges = verdict?.badges ?? [];

      // --- Company Web Scan: identify the ATS platform if we don't know it yet
      let { ats, ats_token } = company;
      let prefetched: RawJob[] | null = null;
      let foundByScan = false;
      if (!ats || !ats_token) {
        const direct = company.careers_url ? detectAts(company.careers_url) : null;
        const scan =
          !direct && company.careers_url ? await scanCompanySite(rec, company.careers_url) : null;
        const hit = direct ?? scan?.hit ?? null;
        // No known ATS: fall back to reading the careers site's own JobPosting
        // markup. Only remembered if it actually finds jobs.
        const fallback =
          !hit && company.careers_url
            ? await ATS_ADAPTERS.jsonld(rec, company.careers_url, company.name)
            : [];
        if (!hit && fallback.length === 0) {
          const platform = scan?.unsupported ?? null;
          const reason = platform
            ? `Uses ${platform}, which the scout has no scanner for (its job list is loaded in the browser, not published as a feed)`
            : "No supported ATS, JobPosting markup or job sitemap found on the careers site";
          if (!opts.dryRun) {
            await store.updateCompany(company.id, {
              last_status: "no_ats",
              last_error: reason,
              last_scanned_at: runStartedAt,
            });
            if (company.careers_url)
              await store.registerUniqueScanner({
                scout_company_id: company.id,
                name: company.name,
                site_url: company.careers_url,
                platform,
                reason,
              });
          }
          return { ...base, status: "no_ats", error: reason };
        }
        ats = hit ? hit.ats : "jsonld";
        ats_token = hit ? hit.token : company.careers_url!;
        if (!hit) prefetched = fallback;
        foundByScan = !!hit && !direct;
        // "Memory": remember the identification so the next run skips the scan.
        if (!opts.dryRun) await store.updateCompany(company.id, { ats, ats_token });
      }

      // --- Call endpoint → map into site schema
      let raw = prefetched ?? (await ATS_ADAPTERS[ats](rec, ats_token, company.name));

      // A board spotted by scanning a careers page can be a stale or internal
      // link with no public jobs. Try the careers page's own markup instead.
      if (raw.length === 0 && foundByScan && company.careers_url) {
        const markup = await ATS_ADAPTERS.jsonld(rec, company.careers_url, company.name);
        if (markup.length) {
          ats = "jsonld";
          ats_token = company.careers_url;
          raw = markup;
          if (!opts.dryRun) await store.updateCompany(company.id, { ats, ats_token });
        }
      }
      const result = await ingest(store, raw, {
        company,
        settings,
        now,
        runStartedAt,
        dryRun: !!opts.dryRun,
        // These sources only include descriptions for some postings; don't
        // count a missing one as a ghost signal.
        descriptionAvailable: ats !== "smartrecruiters" && ats !== "workday",
        tally: tally(ats),
        badgesFor: () => badges,
      });

      if (!opts.dryRun) {
        if (raw.length) await store.resolveUniqueScanner(company.id);
        await store.updateCompany(company.id, {
          last_status: result.passed ? "ok" : "failed_audit",
          last_error: result.passed
            ? null
            : `Only ${Math.round(result.passRate * 100)}% of postings passed validation`,
          last_pass_rate: Math.round(result.passRate * 10000) / 100,
          last_rating: verdict?.summary ?? null,
          last_scanned_at: runStartedAt,
        });
      }
      return {
        ...base,
        ats,
        rating: verdict?.summary,
        status: result.passed ? "ok" : "failed_audit",
        found: raw.length,
        passRate: result.passRate,
        inserted: result.inserted,
        updated: result.updated,
        rejected: result.rejected,
        flagged: result.flagged,
        closed: result.closed,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = error instanceof HttpError ? "http_error" : "error";
      if (!opts.dryRun)
        await store.updateCompany(company.id, {
          last_status: status,
          last_error: message.slice(0, 500),
          last_scanned_at: runStartedAt,
        });
      return { ...base, status, error: message };
    }
  });

  // --- Job boards through JobSpy (off unless configured + enabled by an admin)
  if (opts.jobspyUrl && settings.enabled_boards.length && settings.board_queries.length) {
    for (const q of settings.board_queries) {
      const outcome: CompanyOutcome = {
        company: `Job boards: “${q.search_term}”${q.location ? ` in ${q.location}` : ""}`,
        status: "ok",
        ats: "jobspy",
        found: 0,
        passRate: 1,
        inserted: 0,
        updated: 0,
        rejected: 0,
        flagged: 0,
        closed: 0,
      };
      try {
        const raw = await jobspy(rec, opts.jobspyUrl, opts.jobspyToken ?? null, {
          ...q,
          sites: settings.enabled_boards,
        });
        // Board postings name their employer per row, so the ratings gate runs per posting.
        const verdicts = new Map<string, ReturnType<typeof rate>>();
        const verdictFor = (name: string) => {
          if (!verdicts.has(name)) verdicts.set(name, rate(name));
          return verdicts.get(name)!;
        };
        const allowed = raw.filter((r) => {
          const v = verdictFor(r.company_name);
          return !(v && isGatedOut(v));
        });
        outcome.rejected += raw.length - allowed.length;
        outcome.found += raw.length - allowed.length;
        const bySite = new Map<string, RawJob[]>();
        for (const r of allowed) bySite.set(r.source, [...(bySite.get(r.source) ?? []), r]);
        for (const [site, rows] of bySite) {
          const r = await ingest(store, rows, {
            company: null,
            settings,
            now,
            runStartedAt,
            dryRun: !!opts.dryRun,
            descriptionAvailable: true,
            tally: tally(site),
            badgesFor: (name) => verdictFor(name)?.badges ?? [],
          });
          outcome.found += rows.length;
          outcome.inserted += r.inserted;
          outcome.updated += r.updated;
          outcome.rejected += r.rejected;
          outcome.flagged += r.flagged;
        }
      } catch (error) {
        outcome.status = error instanceof HttpError ? "http_error" : "error";
        outcome.error = error instanceof Error ? error.message : String(error);
      }
      outcomes.push(outcome);
    }
    if (!opts.dryRun) {
      // Boards only return recent postings, so "missing this run" doesn't mean
      // "taken down". Close board postings we haven't seen for two weeks.
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();
      await store.closeUnseen({ sources: settings.enabled_boards }, twoWeeksAgo);
    }
  }

  const sources = new Set([...rec.sources(), ...tallies.keys()]);
  const metrics: SourceMetrics[] = [...sources].map((source) => {
    const t = tallies.get(source);
    return {
      source,
      ...rec.summary(source),
      proxy: null,
      jobs_ingested: t?.ingested.length ?? 0,
      schema_failures: t?.schemaFailures ?? 0,
      field_fill_rates: fillRates(t?.ingested ?? []),
    };
  });

  const sum = (k: keyof CompanyOutcome) => outcomes.reduce((a, o) => a + (Number(o[k]) || 0), 0);
  // Being gated out by the ratings is the gate working, not a failed scan.
  const failed = outcomes.filter((o) => o.status !== "ok" && o.status !== "failed_rating").length;
  return {
    outcomes,
    metrics,
    totals: {
      companies_scanned: outcomes.length,
      jobs_found: sum("found"),
      jobs_inserted: sum("inserted"),
      jobs_updated: sum("updated"),
      jobs_rejected: sum("rejected"),
      jobs_flagged: sum("flagged"),
      jobs_closed: sum("closed"),
    },
    status:
      outcomes.length === 0 || failed === 0
        ? "succeeded"
        : failed === outcomes.length
          ? "failed"
          : "partial",
  };
}

async function ingest(
  store: ScoutStore,
  raw: RawJob[],
  ctx: {
    company: ScoutCompany | null;
    settings: ScoutSettings;
    now: Date;
    runStartedAt: string;
    dryRun: boolean;
    descriptionAvailable: boolean;
    tally: SourceTally;
    badgesFor: (companyName: string) => string[];
  },
) {
  // --- Data-quality check: schema validation across the batch
  const audited = audit(raw, ctx.settings.audit_threshold);
  ctx.tally.schemaFailures += audited.failures.length;
  const empty = { inserted: 0, updated: 0, flagged: 0, closed: 0 };
  if (!audited.passed) {
    return { ...empty, passed: false, passRate: audited.passRate, rejected: raw.length };
  }

  // Duplicate IDs inside one response happen (multi-location postings); keep the first.
  const unique = [
    ...new Map(audited.valid.map((j) => [`${j.source}:${j.external_id}`, j])).values(),
  ];

  const existing = new Map<string, ExistingJob>();
  const bySource = new Map<string, string[]>();
  for (const j of unique)
    bySource.set(j.source, [...(bySource.get(j.source) ?? []), j.external_id]);
  for (const [source, ids] of bySource) {
    for (const e of await store.existingJobs(source, ids))
      existing.set(`${e.source}:${e.external_id}`, e);
  }

  // --- Refine parameters
  const refined = unique.map((j) => {
    const title = cleanTitle(j.title);
    const naics = ctx.company?.naics_code
      ? { code: ctx.company.naics_code, label: ctx.company.industry ?? null }
      : naicsFromIndustry(j.industry_raw ?? ctx.company?.industry);
    const employment_type = normalizeEmploymentType(j.employment_type_raw, j.title);
    const seniority = employment_type === "internship" ? "intern" : inferSeniority(title);
    const track = classifyTrack({
      title,
      description: j.description,
      employment_type,
      seniority,
      pay: j.pay,
      companyType: ctx.company?.company_type,
    });
    return {
      raw: j,
      row: {
        source: j.source,
        external_id: j.external_id,
        scout_company_id: ctx.company?.id ?? null,
        title,
        company_name: j.company_name,
        location: j.location,
        description: j.description,
        apply_url: j.apply_url,
        department: j.department,
        industry: ctx.company?.industry ?? j.industry_raw ?? naics?.label ?? null,
        naics_code: naics?.code ?? null,
        employment_type,
        type: employmentTypeLabel(employment_type),
        seniority,
        remote: isRemote(j.location, j.remote_hint),
        posted_at: j.posted_at,
        employer_badges: ctx.badgesFor(j.company_name),
        track: track.track,
        track_reasons: track.reasons,
        pay_min: j.pay?.min ?? null,
        pay_max: j.pay?.max ?? null,
        pay_unit: j.pay?.unit ?? null,
        fingerprint: fingerprint(j.company_name, title, j.location),
        ghost_score: 0,
        ghost_reasons: [] as string[],
        status: "active" as NormalizedJob["status"],
      } satisfies NormalizedJob,
    };
  });

  // --- Ghost Job Detector v2 (reposts counted across this batch AND the database)
  const keys = new Set(refined.map((r) => `${r.row.source}:${r.row.external_id}`));
  const dbCounts = await store.fingerprintCounts(
    [...new Set(refined.map((r) => r.row.fingerprint))],
    keys,
  );
  const batchCounts = new Map<string, number>();
  for (const r of refined)
    batchCounts.set(r.row.fingerprint, (batchCounts.get(r.row.fingerprint) ?? 0) + 1);

  let flagged = 0;
  for (const r of refined) {
    const prior = existing.get(`${r.row.source}:${r.row.external_id}`);
    const g = scoreGhost({
      title: r.row.title,
      description: r.row.description,
      descriptionAvailable: ctx.descriptionAvailable,
      location: r.row.location,
      posted_at: r.row.posted_at,
      first_seen_at: prior?.first_seen_at ?? null,
      sameFingerprintOthers:
        (dbCounts.get(r.row.fingerprint) ?? 0) + (batchCounts.get(r.row.fingerprint)! - 1),
      now: ctx.now,
    });
    r.row.ghost_score = g.score;
    r.row.ghost_reasons = g.reasons;
    if (g.score >= ctx.settings.ghost_threshold && !prior?.ghost_override) {
      r.row.status = "flagged";
      flagged++;
    }
  }

  const rows = refined.map((r) => r.row);
  ctx.tally.ingested.push(...rows);
  if (ctx.dryRun) {
    return {
      ...empty,
      passed: true,
      passRate: audited.passRate,
      rejected: audited.failures.length,
      flagged,
      inserted: rows.length,
    };
  }

  // --- Normalization → upsert, then close whatever disappeared from the board
  const { inserted, updated } = await store.upsertJobs(
    rows.map((r) => ({ ...r, last_seen_at: ctx.runStartedAt })),
  );
  const closed = ctx.company
    ? await store.closeUnseen({ scout_company_id: ctx.company.id }, ctx.runStartedAt)
    : 0;
  return {
    passed: true,
    passRate: audited.passRate,
    rejected: audited.failures.length,
    inserted,
    updated,
    flagged,
    closed,
  };
}
