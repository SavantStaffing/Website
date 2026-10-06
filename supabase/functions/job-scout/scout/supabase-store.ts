// Generated from src/lib/scout/supabase-store.ts by scripts/build-scout-function.mjs. Do not edit.
import type { EthicsRecord } from "./ethics.ts";
import {
  DEFAULT_SETTINGS,
  runScout,
  sweepEmployerEthics,
  type CompanyOutcome,
  type EthicsOptions,
  type RunSummary,
  type ScoutSettings,
  type ScoutStore,
} from "./pipeline.ts";
import {
  DEFAULT_RATINGS_CONFIG,
  type CompanyRating,
  type RatingsConfig,
  type RatingSource,
} from "./ratings.ts";
import type { CompanyType } from "./track.ts";
import type { AdzunaCredentials, ApiUsage } from "./aggregators.ts";
import type { AtsPlatform, BoardSource, ScoutCompany } from "./types.ts";

/**
 * Supabase-backed ScoutStore and run recording, shared by the app
 * (store.server.ts, with the typed service-role client) and the scheduled
 * Edge Function (supabase/functions/job-scout). Takes the client as a
 * parameter and uses relative imports only, so the same file runs under
 * Vite, Node and Deno.
 *
 * Callers must pass a service-role client and must already have checked the
 * requester (admin, cron token): the scout writes jobs across organizations.
 */

// The slice of supabase-js used here, so this module doesn't import it.
export type ScoutDb = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  // The typed client narrows `fn` to known function names; accept any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: any, args?: any) => any;
};

type Row = Record<string, unknown>;

const chunk = <T>(arr: T[], n: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

export function createScoutStore(db: ScoutDb): ScoutStore {
  // existingJobs() is always called before upsertJobs() for the same rows, so
  // remembering which keys already existed lets upsert report inserted vs updated.
  const known = new Set<string>();

  return {
    async listCompanies(ids) {
      let q = db.from("scout_companies").select("*").order("name");
      if (ids?.length) q = q.in("id", ids);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return ((data ?? []) as Row[]).map((c) => ({
        ...(c as ScoutCompany),
        ats: c.ats as AtsPlatform | null,
        rating_override: c.rating_override as "pass" | "fail" | null,
        company_type: c.company_type as CompanyType,
      }));
    },

    async updateCompany(id, patch) {
      const { error } = await db.from("scout_companies").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },

    async existingJobs(source, externalIds) {
      const out = [];
      for (const ids of chunk(externalIds, 200)) {
        const { data, error } = await db
          .from("jobs")
          .select("source, external_id, first_seen_at, ghost_override")
          .eq("source", source)
          .in("external_id", ids);
        if (error) throw new Error(error.message);
        for (const r of (data ?? []) as {
          source: string;
          external_id: string;
          first_seen_at: string;
          ghost_override: boolean;
        }[]) {
          known.add(`${r.source}:${r.external_id}`);
          out.push(r);
        }
      }
      return out;
    },

    async fingerprintCounts(fingerprints, exclude) {
      const counts = new Map<string, number>();
      for (const fps of chunk(fingerprints, 100)) {
        const { data, error } = await db
          .from("jobs")
          .select("source, external_id, fingerprint")
          .in("fingerprint", fps)
          .neq("status", "closed");
        if (error) throw new Error(error.message);
        for (const r of (data ?? []) as {
          source: string;
          external_id: string;
          fingerprint: string | null;
        }[]) {
          if (!r.fingerprint || exclude.has(`${r.source}:${r.external_id}`)) continue;
          counts.set(r.fingerprint, (counts.get(r.fingerprint) ?? 0) + 1);
        }
      }
      return counts;
    },

    async upsertJobs(rows) {
      let inserted = 0;
      for (const r of rows) if (!known.has(`${r.source}:${r.external_id}`)) inserted++;
      // A scan is the source of truth for what's live, so it clears any expiry
      // left on a posting by a one-off load.
      for (const batch of chunk(
        rows.map((r) => ({ ...r, valid_through: null })),
        100,
      )) {
        const { error } = await db.from("jobs").upsert(batch, { onConflict: "source,external_id" });
        if (error) throw new Error(error.message);
      }
      return { inserted, updated: rows.length - inserted };
    },

    async closeUnseen(filter, seenSince) {
      let q = db
        .from("jobs")
        .update({ status: "closed" })
        .lt("last_seen_at", seenSince)
        .neq("status", "closed");
      if (filter.scout_company_id) q = q.eq("scout_company_id", filter.scout_company_id);
      else if (filter.sources?.length) q = q.in("source", filter.sources);
      else return 0; // never close everything
      const { data, error } = await q.select("id");
      if (error) throw new Error(error.message);
      return data?.length ?? 0;
    },

    async registerUniqueScanner(site) {
      const now = new Date().toISOString();
      const { data: existing } = await db
        .from("unique_scanner_sites")
        .select("id, status")
        .eq("scout_company_id", site.scout_company_id)
        .maybeSingle();
      if (existing) {
        // Keep the admin's triage (in progress / won't build); a "supported"
        // site that stopped working goes back in the queue.
        const { error } = await db
          .from("unique_scanner_sites")
          .update({
            name: site.name,
            site_url: site.site_url,
            reason: site.reason,
            last_checked_at: now,
            ...(site.platform ? { platform: site.platform } : {}),
            ...(existing.status === "supported" ? { status: "needs_scanner" } : {}),
          })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await db
        .from("unique_scanner_sites")
        .insert({ ...site, last_checked_at: now });
      if (error) throw new Error(error.message);
    },

    async getEthics(companyKey) {
      const { data, error } = await db
        .from("employer_ethics")
        .select("*")
        .eq("company_key", companyKey)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
      return {
        ...(data as EthicsRecord),
        fair_pay_score: num(data.fair_pay_score),
        cultures_score: num(data.cultures_score),
        honest_score: num(data.honest_score),
        dol_back_wages: Number(data.dol_back_wages),
        osha_penalties: Number(data.osha_penalties),
      };
    },

    async saveEthics(record) {
      const { error } = await db
        .from("employer_ethics")
        .upsert(record, { onConflict: "company_key" });
      if (error) throw new Error(error.message);
    },

    async employerListingCounts() {
      const { data, error } = await db.rpc("employer_listing_counts");
      if (error) throw new Error(error.message);
      return ((data ?? []) as { company_name: string; listings: number }[]).map((r) => ({
        company_name: r.company_name,
        listings: Number(r.listings),
      }));
    },

    async apiUsage(source): Promise<ApiUsage> {
      const { data, error } = await db
        .from("scout_api_usage")
        .select("day, requests, last_request_at")
        .eq("source", source);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { day: string; requests: number; last_request_at: string }[];
      // Days are UTC dates, as the database stores them.
      const dayAgo = (n: number) =>
        new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
      const sum = (since: string) =>
        rows.filter((r) => r.day > since).reduce((a, r) => a + r.requests, 0);
      return {
        today: sum(dayAgo(1)),
        last7Days: sum(dayAgo(7)),
        last30Days: sum(dayAgo(30)),
        total: rows.reduce((a, r) => a + r.requests, 0),
        lastRequestAt:
          rows
            .map((r) => r.last_request_at)
            .sort()
            .at(-1) ?? null,
      };
    },

    async recordApiRequest(source) {
      const { data, error } = await db.rpc("record_scout_api_request", { p_source: source });
      if (error) throw new Error(error.message);
      return { today: Number(data?.today ?? 0), total: Number(data?.total ?? 0) };
    },

    async resolveUniqueScanner(companyId) {
      const { error } = await db
        .from("unique_scanner_sites")
        .update({ status: "supported", last_checked_at: new Date().toISOString() })
        .eq("scout_company_id", companyId)
        .in("status", ["needs_scanner", "in_progress"]);
      if (error) throw new Error(error.message);
    },
  };
}

export async function loadScoutSettings(db: ScoutDb): Promise<ScoutSettings> {
  const { data } = await db.from("scout_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    enabled_boards: data.enabled_boards as BoardSource[],
    board_queries: (Array.isArray(data.board_queries)
      ? data.board_queries
      : []) as ScoutSettings["board_queries"],
    ghost_threshold: data.ghost_threshold,
    audit_threshold: Number(data.audit_threshold),
    max_per_position: data.max_per_position ?? DEFAULT_SETTINGS.max_per_position,
    max_age_days: data.max_age_days ?? DEFAULT_SETTINGS.max_age_days,
  };
}

/** JUST Capital / As You Sow lists and the cutoffs from scout_settings. */
export async function loadRatings(
  db: ScoutDb,
): Promise<{ config: RatingsConfig; list: CompanyRating[] }> {
  const [{ data: settings }, list] = await Promise.all([
    db.from("scout_settings").select("*").eq("id", 1).maybeSingle(),
    (async () => {
      const rows: CompanyRating[] = [];
      // PostgREST caps a response at 1000 rows; page through.
      for (let from = 0; ; from += 1000) {
        // "*" so a database without the employees column yet still loads.
        const { data, error } = await db
          .from("company_ratings")
          .select("*")
          .range(from, from + 999);
        if (error) throw new Error(error.message);
        const page = (data ?? []) as (Omit<CompanyRating, "source" | "score" | "employees"> & {
          source: string;
          score: number | string | null;
          employees?: number | null;
        })[];
        rows.push(
          ...page.map((r) => ({
            source: r.source as RatingSource,
            company_name: r.company_name,
            normalized_name: r.normalized_name,
            rank: r.rank,
            score: r.score === null ? null : Number(r.score),
            employees: r.employees ?? null,
          })),
        );
        if (page.length < 1000) break;
      }
      return rows;
    })(),
  ]);
  const config: RatingsConfig = settings
    ? {
        enabled: settings.ratings_enabled,
        just_capital_max_rank: settings.just_capital_max_rank,
        as_you_sow_min_score: Number(settings.as_you_sow_min_score),
        as_you_sow_min_employees:
          settings.as_you_sow_min_employees ?? DEFAULT_RATINGS_CONFIG.as_you_sow_min_employees,
        mode: settings.ratings_mode === "any" ? "any" : "all",
      }
    : DEFAULT_RATINGS_CONFIG;
  return { config, list };
}

/**
 * Live employer-ethics settings: cutoffs from scout_settings, API keys from
 * scout_secrets (readable by the service role only). Falls back to the
 * given keys (e.g. local env) when the table has none.
 */
export async function loadEthicsOptions(
  db: ScoutDb,
  fallback: { dolApiKey?: string | null; wikirateKey?: string | null } = {},
): Promise<EthicsOptions> {
  const [{ data: settings }, { data: secrets }] = await Promise.all([
    db.from("scout_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("scout_secrets").select("dol_api_key, wikirate_api_key").eq("id", 1).maybeSingle(),
  ]);
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    enabled: settings?.ethics_enabled ?? true,
    dolApiKey: secrets?.dol_api_key || fallback.dolApiKey || null,
    wikirateKey: secrets?.wikirate_api_key || fallback.wikirateKey || null,
    minFairPay: num(settings?.ethics_min_fair_pay),
    minCultures: num(settings?.ethics_min_cultures),
    minHonest: num(settings?.ethics_min_honest),
  };
}

/**
 * Job-aggregator API keys from scout_secrets (service role only), falling
 * back to the given ones (local env). A source with no key is skipped.
 */
export async function loadAggregatorKeys(
  db: ScoutDb,
  fallback: { adzuna?: AdzunaCredentials | null; joobleKey?: string | null } = {},
): Promise<{ adzuna: AdzunaCredentials | null; joobleKey: string | null }> {
  // "*" so a database without these columns yet still loads (keys just come up empty).
  const { data } = await db.from("scout_secrets").select("*").eq("id", 1).maybeSingle();
  const appId = data?.adzuna_app_id || fallback.adzuna?.appId;
  const appKey = data?.adzuna_app_key || fallback.adzuna?.appKey;
  return {
    adzuna: appId && appKey ? { appId, appKey } : null,
    joobleKey: data?.jooble_api_key || fallback.joobleKey || null,
  };
}

/** Run the scout and record the run + per-source diagnostics. */
export async function runAndRecord(
  db: ScoutDb,
  opts: {
    trigger: "manual" | "scheduled";
    triggeredBy: string | null;
    companyIds?: string[];
    jobspyUrl?: string | null;
    jobspyToken?: string | null;
    /** Keys to use when scout_secrets has none (local development). */
    dolApiKey?: string | null;
    wikirateKey?: string | null;
    adzuna?: AdzunaCredentials | null;
    joobleKey?: string | null;
  },
): Promise<{ runId: string; summary: RunSummary }> {
  const { data: run, error } = await db
    .from("scout_runs")
    .insert({ trigger: opts.trigger, triggered_by: opts.triggeredBy })
    .select("id")
    .single();
  if (error || !run) throw new Error(error?.message ?? "Could not start run");

  try {
    const summary = await runScout(createScoutStore(db), {
      companyIds: opts.companyIds,
      settings: await loadScoutSettings(db),
      jobspyUrl: opts.jobspyUrl ?? null,
      jobspyToken: opts.jobspyToken ?? null,
      ratings: await loadRatings(db),
      aggregators: await loadAggregatorKeys(db, { adzuna: opts.adzuna, joobleKey: opts.joobleKey }),
      ethics: await loadEthicsOptions(db, {
        dolApiKey: opts.dolApiKey,
        wikirateKey: opts.wikirateKey,
      }),
    });
    await db
      .from("scout_runs")
      .update({ ...summary.totals, status: summary.status, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    if (summary.metrics.length) {
      await db
        .from("scout_source_metrics")
        .insert(summary.metrics.map((m) => ({ ...m, run_id: run.id })));
    }
    return { runId: run.id, summary };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db
      .from("scout_runs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    throw e;
  }
}

/**
 * Run the employer ethics sweep (pipeline.ts) and record it as a run, so it
 * shows in the admin's run history with its Wikirate / DOL request metrics.
 */
export async function runEthicsSweep(
  db: ScoutDb,
  opts: {
    trigger: "manual" | "scheduled";
    triggeredBy: string | null;
    dolApiKey?: string | null;
    wikirateKey?: string | null;
  },
): Promise<{ runId: string | null; outcome: CompanyOutcome | null }> {
  const ethics = await loadEthicsOptions(db, {
    dolApiKey: opts.dolApiKey,
    wikirateKey: opts.wikirateKey,
  });
  if (!ethics.enabled) return { runId: null, outcome: null };
  const { data: run, error } = await db
    .from("scout_runs")
    .insert({ trigger: opts.trigger, triggered_by: opts.triggeredBy })
    .select("id")
    .single();
  if (error || !run) throw new Error(error?.message ?? "Could not start run");
  const { outcome, metrics } = await sweepEmployerEthics(createScoutStore(db), ethics);
  await db
    .from("scout_runs")
    .update({
      companies_scanned: outcome.found,
      jobs_found: 0,
      jobs_inserted: 0,
      jobs_updated: 0,
      jobs_rejected: 0,
      jobs_flagged: 0,
      jobs_closed: 0,
      status: outcome.status === "ok" ? "succeeded" : "failed",
      error: outcome.error ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run.id);
  if (metrics.length)
    await db.from("scout_source_metrics").insert(metrics.map((m) => ({ ...m, run_id: run.id })));
  return { runId: run.id, outcome };
}

/**
 * Enabled companies, least recently scanned first (never-scanned first of
 * all). The scheduled scan takes the head of this list each time, so every
 * company is refreshed in turn however many there are.
 */
export async function stalestCompanyIds(db: ScoutDb, n: number): Promise<string[]> {
  const { data, error } = await db
    .from("scout_companies")
    .select("id")
    .eq("enabled", true)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(n);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}
