import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Admin-only entry points to the Job Scout. Each one re-verifies the caller
 * is an admin before touching the service-role client — the scout writes
 * across organizations, so RLS can't be the only gate here.
 */

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r) => r.role === "admin")) {
    throw new Error("Forbidden: admin role required");
  }
}

export const runScoutNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ companyIds: z.array(z.string().uuid()).max(500).optional() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { runAndRecord } = await import("./store.server");
    const { runId, summary } = await runAndRecord({
      trigger: "manual",
      triggeredBy: context.userId,
      companyIds: data.companyIds,
    });
    return { runId, status: summary.status, totals: summary.totals, outcomes: summary.outcomes };
  });

/** "Company Web Scan" for the add-company form: find which ATS a careers URL uses. */
export const detectCompanyAts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ url: z.string().trim().min(3).max(500) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { scanCompanySite } = await import("./webscan");
    const { MetricsRecorder } = await import("./http");
    const { boardUrl } = await import("./detect");
    const { hit, all, checked, unsupported } = await scanCompanySite(
      new MetricsRecorder(),
      data.url,
    );
    return {
      hit: hit ? { ...hit, board: boardUrl(hit.ats, hit.token) } : null,
      alternatives: all.slice(1).map((h) => ({ ...h, board: boardUrl(h.ats, h.token) })),
      checked,
      unsupported,
    };
  });

/** Which optional integrations are configured on the server (never returns the values). */
export const getScoutEnvStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    return {
      jobspy: !!process.env.JOBSPY_URL,
      cron: !!process.env.SCOUT_CRON_SECRET,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
    };
  });
