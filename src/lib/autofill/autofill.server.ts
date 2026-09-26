import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { draftOpenAnswers } from "./drafter.server";
import { getGreenhouseFields } from "./greenhouse";
import {
  buildPlan,
  detectJob,
  EEO_RE,
  norm,
  type AutofillProfile,
  type FillPlan,
  type FormField,
} from "./mapper";

/**
 * Autofill service (ported from the prototype's FastAPI main.py). Used by
 * the "Savant Apply" browser extension through /api/autofill/* and by the
 * talent feed's readiness badge. The service-role client bypasses RLS, so
 * every query below filters on the verified user id.
 */

export class AutofillError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Verify a Supabase access token (the extension sends the user's session token). */
export async function userFromRequest(request: Request): Promise<string> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new AutofillError(401, "Missing session");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new AutofillError(401, "Invalid or expired session");
  return data.user.id;
}

async function loadProfile(uid: string): Promise<AutofillProfile> {
  const [{ data: tp }, { data: base }] = await Promise.all([
    supabaseAdmin.from("talent_profiles").select("*").eq("user_id", uid).maybeSingle(),
    supabaseAdmin.from("profiles").select("email, phone").eq("id", uid).maybeSingle(),
  ]);
  if (!tp) throw new AutofillError(404, "Complete your Talent profile first");
  const { skills: _skills, ...rest } = tp;
  return { ...rest, email: base?.email ?? null, phone: base?.phone ?? null };
}

async function loadSaved(uid: string): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin
    .from("saved_answers")
    .select("question_key, answer")
    .eq("user_id", uid);
  return Object.fromEntries((data ?? []).map((r) => [r.question_key, r.answer]));
}

export async function createPlan(
  uid: string,
  req: { job_url: string; fields: FormField[]; job_description?: string | null },
): Promise<FillPlan> {
  const ats = detectJob(req.job_url)?.ats ?? "generic";
  const profile = await loadProfile(uid);
  const fills = buildPlan(ats, req.fields, profile, await loadSaved(uid));
  await draftOpenAnswers(fills, profile.resume_text as string | null, req.job_description);

  const unresolved_required = fills
    .filter((f) => f.required && f.value === null && f.section !== "eeo")
    .map((f) => f.label);
  const plan: FillPlan = { ats, job_url: req.job_url, fills, unresolved_required };

  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id")
    .eq("apply_url", req.job_url)
    .maybeSingle();
  await supabaseAdmin.from("autofill_plans").insert({
    user_id: uid,
    job_id: job?.id ?? null,
    ats,
    job_url: req.job_url,
    status: "filled",
    fill_plan: plan as unknown as Json,
  });
  return plan;
}

/** Called on submit: remember what the candidate actually answered. */
export async function saveAnswers(
  uid: string,
  req: { job_url: string; answers: { label: string; answer: string }[] },
) {
  const rows = req.answers
    .filter((a) => a.answer.trim() && !EEO_RE.test(a.label))
    .map((a) => ({ user_id: uid, question_key: norm(a.label), answer: a.answer.trim() }));
  if (rows.length) {
    await supabaseAdmin.from("saved_answers").upsert(rows, { onConflict: "user_id,question_key" });
  }
  await supabaseAdmin
    .from("autofill_plans")
    .update({ status: "submitted" })
    .eq("user_id", uid)
    .eq("job_url", req.job_url)
    .eq("status", "filled");

  // Mirror it into the Savant dashboard so the talent sees it under Applications.
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id")
    .eq("apply_url", req.job_url)
    .maybeSingle();
  if (job) {
    // "started" (opened from the feed) → "submitted"; never touch a status a recruiter already moved on.
    await supabaseAdmin
      .from("job_applications")
      .update({ status: "submitted" })
      .eq("job_id", job.id)
      .eq("applicant_id", uid)
      .eq("status", "started");
    await supabaseAdmin
      .from("job_applications")
      .upsert(
        { job_id: job.id, applicant_id: uid, status: "submitted" },
        { onConflict: "job_id,applicant_id", ignoreDuplicates: true },
      );
  }
  return { saved: rows.length };
}

/** For the feed ranking: how many required questions can this candidate already answer? */
export async function readiness(uid: string, jobUrl: string) {
  const hit = detectJob(jobUrl);
  if (!hit || hit.ats !== "greenhouse") return { supported: false as const };
  const { fields } = await getGreenhouseFields(hit.token, hit.jobId);
  let profile: AutofillProfile;
  try {
    profile = await loadProfile(uid);
  } catch {
    profile = {};
  }
  const fills = buildPlan("greenhouse", fields, profile, await loadSaved(uid));
  const required = fills.filter((f) => f.required && f.section !== "eeo");
  const missing = required.filter((f) => f.value === null).map((f) => f.label);
  return {
    supported: true as const,
    required: required.length,
    answerable: required.length - missing.length,
    missing,
  };
}
