import { supabaseAdmin } from "@/integrations/supabase/client.server";
import * as shared from "./supabase-store";

/**
 * The app's entry to the Supabase-backed scout: the shared store
 * (supabase-store.ts) bound to the service-role client. Callers must have
 * already verified the requester is an admin (scout.functions.ts) or holds
 * the cron secret (routes/api.scout.run.ts). The scheduled scans run the
 * same code in the job-scout Edge Function.
 */

export const loadScoutSettings = () => shared.loadScoutSettings(supabaseAdmin);

export const loadRatings = () => shared.loadRatings(supabaseAdmin);

export function runAndRecord(opts: {
  trigger: "manual" | "scheduled";
  triggeredBy: string | null;
  companyIds?: string[];
}) {
  return shared.runAndRecord(supabaseAdmin, {
    ...opts,
    jobspyUrl: process.env.JOBSPY_URL || null,
    jobspyToken: process.env.JOBSPY_TOKEN || null,
    dolApiKey: process.env.DOL_API_KEY || null,
    wikirateKey: process.env.WIKIRATE_API_KEY || null,
  });
}
