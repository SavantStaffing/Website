/**
 * Scheduled Job Scout (Supabase Edge Function).
 *
 * pg_cron calls this every 15 minutes (see migration
 * 20260927000006_schedule_job_scout.sql). Each call scans the enabled
 * company that was scanned longest ago, so every company is refreshed in
 * turn and a single call stays inside the Edge Function limits (2s CPU,
 * 150s wall clock). It answers at once and runs the scan as a background
 * task; results land in scout_runs like any other run.
 *
 * Auth: the caller must send the x-scout-token header matching
 * scout_settings.cron_token (random, generated in the database; pg_cron
 * reads it there). The function itself uses the service-role key Supabase
 * provides to every Edge Function.
 *
 * The scout code under ./scout is copied from src/lib/scout by
 * `node scripts/build-scout-function.mjs`; edit it there, not here.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { setJobPageLimit } from "./scout/jobposting.ts";
import { runAndRecord, stalestCompanyIds } from "./scout/supabase-store.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

// Parsing job pages is the CPU-heavy part; cap careers-site crawls per company.
setJobPageLimit(35);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: settings } = await db
    .from("scout_settings")
    .select("cron_token")
    .eq("id", 1)
    .maybeSingle();
  const token = req.headers.get("x-scout-token") ?? "";
  if (!settings?.cron_token || token !== settings.cron_token) {
    return json({ error: "Unauthorized" }, 401);
  }

  const body = (await req.json().catch(() => ({}))) as {
    companies?: number;
    companyIds?: string[];
  };
  const n = Math.min(Math.max(Number(body.companies ?? 1) || 1, 1), 3);
  const ids = body.companyIds?.length
    ? body.companyIds.slice(0, 3)
    : await stalestCompanyIds(db, n);
  if (ids.length === 0) return json({ skipped: "No enabled companies" });

  EdgeRuntime.waitUntil(
    runAndRecord(db, { trigger: "scheduled", triggeredBy: null, companyIds: ids })
      .then(({ runId, summary }) =>
        console.log(
          `scout run ${runId}: ${summary.status}`,
          JSON.stringify(summary.outcomes.map((o) => [o.company, o.status, o.found])),
        ),
      )
      .catch((e) => console.error("scout run failed:", e instanceof Error ? e.message : e)),
  );
  return json({ started: ids }, 202);
});
