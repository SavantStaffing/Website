import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  DEFAULT_SETTINGS,
  runScout,
  type RunSummary,
  type ScoutSettings,
  type ScoutStore,
} from "./pipeline";
import {
  DEFAULT_RATINGS_CONFIG,
  type CompanyRating,
  type RatingsConfig,
  type RatingSource,
} from "./ratings";
import type { CompanyType } from "./track";
import type { AtsPlatform, BoardSource, ScoutCompany } from "./types";

/**
 * Supabase-backed ScoutStore. Runs with the service-role client because the
 * scout writes jobs that belong to no organization; callers must have
 * already verified the requester is an admin (scout.functions.ts) or holds
 * the cron secret (routes/api.scout.run.ts).
 */

const chunk = <T>(arr: T[], n: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

function createSupabaseScoutStore(): ScoutStore {
  // existingJobs() is always called before upsertJobs() for the same rows, so
  // remembering which keys already existed lets upsert report inserted vs updated.
  const known = new Set<string>();

  return {
    async listCompanies(ids) {
      let q = supabaseAdmin.from("scout_companies").select("*").order("name");
      if (ids?.length) q = q.in("id", ids);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map((c) => ({
        ...c,
        ats: c.ats as AtsPlatform | null,
        rating_override: c.rating_override as "pass" | "fail" | null,
        company_type: c.company_type as CompanyType,
      })) satisfies ScoutCompany[];
    },

    async updateCompany(id, patch) {
      const { error } = await supabaseAdmin.from("scout_companies").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },

    async existingJobs(source, externalIds) {
      const out = [];
      for (const ids of chunk(externalIds, 200)) {
        const { data, error } = await supabaseAdmin
          .from("jobs")
          .select("source, external_id, first_seen_at, ghost_override")
          .eq("source", source)
          .in("external_id", ids);
        if (error) throw new Error(error.message);
        for (const r of data ?? []) {
          known.add(`${r.source}:${r.external_id}`);
          out.push({ ...r, external_id: r.external_id! });
        }
      }
      return out;
    },

    async fingerprintCounts(fingerprints, exclude) {
      const counts = new Map<string, number>();
      for (const fps of chunk(fingerprints, 100)) {
        const { data, error } = await supabaseAdmin
          .from("jobs")
          .select("source, external_id, fingerprint")
          .in("fingerprint", fps)
          .neq("status", "closed");
        if (error) throw new Error(error.message);
        for (const r of data ?? []) {
          if (!r.fingerprint || exclude.has(`${r.source}:${r.external_id}`)) continue;
          counts.set(r.fingerprint, (counts.get(r.fingerprint) ?? 0) + 1);
        }
      }
      return counts;
    },

    async upsertJobs(rows) {
      let inserted = 0;
      for (const r of rows) if (!known.has(`${r.source}:${r.external_id}`)) inserted++;
      for (const batch of chunk(rows, 100)) {
        const { error } = await supabaseAdmin
          .from("jobs")
          .upsert(batch, { onConflict: "source,external_id" });
        if (error) throw new Error(error.message);
      }
      return { inserted, updated: rows.length - inserted };
    },

    async closeUnseen(filter, seenSince) {
      let q = supabaseAdmin
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
      const { data: existing } = await supabaseAdmin
        .from("unique_scanner_sites")
        .select("id, status")
        .eq("scout_company_id", site.scout_company_id)
        .maybeSingle();
      if (existing) {
        // Keep the admin's triage (in progress / won't build); a "supported"
        // site that stopped working goes back in the queue.
        const { error } = await supabaseAdmin
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
      const { error } = await supabaseAdmin
        .from("unique_scanner_sites")
        .insert({ ...site, last_checked_at: now });
      if (error) throw new Error(error.message);
    },

    async resolveUniqueScanner(companyId) {
      const { error } = await supabaseAdmin
        .from("unique_scanner_sites")
        .update({ status: "supported", last_checked_at: new Date().toISOString() })
        .eq("scout_company_id", companyId)
        .in("status", ["needs_scanner", "in_progress"]);
      if (error) throw new Error(error.message);
    },
  };
}

export async function loadScoutSettings(): Promise<ScoutSettings> {
  const { data } = await supabaseAdmin.from("scout_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    enabled_boards: data.enabled_boards as BoardSource[],
    board_queries: (Array.isArray(data.board_queries)
      ? data.board_queries
      : []) as ScoutSettings["board_queries"],
    ghost_threshold: data.ghost_threshold,
    audit_threshold: Number(data.audit_threshold),
  };
}

/** JUST Capital / As You Sow lists and the cutoffs from scout_settings. */
export async function loadRatings(): Promise<{ config: RatingsConfig; list: CompanyRating[] }> {
  const [{ data: settings }, list] = await Promise.all([
    supabaseAdmin.from("scout_settings").select("*").eq("id", 1).maybeSingle(),
    (async () => {
      const rows: CompanyRating[] = [];
      // PostgREST caps a response at 1000 rows; page through.
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabaseAdmin
          .from("company_ratings")
          .select("source, company_name, normalized_name, rank, score")
          .range(from, from + 999);
        if (error) throw new Error(error.message);
        rows.push(
          ...(data ?? []).map((r) => ({
            ...r,
            source: r.source as RatingSource,
            score: r.score === null ? null : Number(r.score),
          })),
        );
        if (!data || data.length < 1000) break;
      }
      return rows;
    })(),
  ]);
  const config: RatingsConfig = settings
    ? {
        enabled: settings.ratings_enabled,
        just_capital_max_rank: settings.just_capital_max_rank,
        as_you_sow_min_score: Number(settings.as_you_sow_min_score),
        mode: settings.ratings_mode === "any" ? "any" : "all",
      }
    : DEFAULT_RATINGS_CONFIG;
  return { config, list };
}

/** Run the scout and record the run + per-source diagnostics. */
export async function runAndRecord(opts: {
  trigger: "manual" | "scheduled";
  triggeredBy: string | null;
  companyIds?: string[];
}): Promise<{ runId: string; summary: RunSummary }> {
  const { data: run, error } = await supabaseAdmin
    .from("scout_runs")
    .insert({ trigger: opts.trigger, triggered_by: opts.triggeredBy })
    .select("id")
    .single();
  if (error || !run) throw new Error(error?.message ?? "Could not start run");

  try {
    const summary = await runScout(createSupabaseScoutStore(), {
      companyIds: opts.companyIds,
      settings: await loadScoutSettings(),
      jobspyUrl: process.env.JOBSPY_URL || null,
      jobspyToken: process.env.JOBSPY_TOKEN || null,
      ratings: await loadRatings(),
    });
    await supabaseAdmin
      .from("scout_runs")
      .update({ ...summary.totals, status: summary.status, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    if (summary.metrics.length) {
      await supabaseAdmin.from("scout_source_metrics").insert(
        summary.metrics.map((m) => ({
          ...m,
          run_id: run.id,
          status_counts: m.status_counts as Json,
          field_fill_rates: m.field_fill_rates as Json,
        })),
      );
    }
    return { runId: run.id, summary };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("scout_runs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    throw e;
  }
}
