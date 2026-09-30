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

/**
 * The job's apply_url for a URL the extension reports. It sends the page it
 * ran on, which can be the form step (Lever /apply, Ashby /application) or
 * carry a hash, rather than the posting URL stored on the job.
 */
function postingUrls(url: string): string[] {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return [url];
  }
  u.hash = "";
  const exact = u.toString();
  u.pathname = u.pathname.replace(/\/(apply|application)\/?$/, "");
  return [...new Set([url, exact, u.toString()])];
}

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

/** How long the resume link handed to the extension stays valid. */
const RESUME_LINK_SECONDS = 600;

/**
 * The talent's profile as Autofill uses it. With `withResumeLink`, resume_path
 * becomes a short-lived signed URL the extension downloads and attaches;
 * otherwise it's just the storage path (enough to know a file exists).
 */
async function loadProfile(
  uid: string,
  opts: { withResumeLink?: boolean } = {},
): Promise<AutofillProfile> {
  const [{ data: tp }, { data: base }] = await Promise.all([
    supabaseAdmin.from("talent_profiles").select("*").eq("user_id", uid).maybeSingle(),
    supabaseAdmin.from("profiles").select("email, phone").eq("id", uid).maybeSingle(),
  ]);
  if (!tp) throw new AutofillError(404, "Complete your Talent profile first");
  const { skills: _skills, ...rest } = tp;
  let resumePath = tp.resume_path ?? null;
  if (resumePath && opts.withResumeLink) {
    const { data } = await supabaseAdmin.storage
      .from("resumes")
      .createSignedUrl(resumePath, RESUME_LINK_SECONDS);
    resumePath = data?.signedUrl ?? null; // no link → the resume field is left for the talent
  }
  return {
    ...rest,
    resume_path: resumePath,
    email: base?.email ?? null,
    phone: base?.phone ?? null,
  };
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
  const profile = await loadProfile(uid, { withResumeLink: true });
  const fills = buildPlan(ats, req.fields, profile, await loadSaved(uid));
  await draftOpenAnswers(fills, profile.resume_text as string | null, req.job_description);

  const unresolved_required = fills
    .filter((f) => f.required && f.value === null && f.section !== "eeo")
    .map((f) => f.label);
  const plan: FillPlan = { ats, job_url: req.job_url, fills, unresolved_required };

  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id")
    .in("apply_url", postingUrls(req.job_url))
    .limit(1)
    .maybeSingle();
  await supabaseAdmin.from("autofill_plans").insert({
    user_id: uid,
    job_id: job?.id ?? null,
    ats,
    job_url: req.job_url,
    status: "filled",
    // The resume link is a short-lived credential; don't keep it in the log.
    fill_plan: {
      ...plan,
      fills: plan.fills.map((f) =>
        f.type === "file" && f.value ? { ...f, value: "[resume]" } : f,
      ),
    } as unknown as Json,
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
    .map((a) => ({
      user_id: uid,
      question_key: norm(a.label),
      question_label: a.label.trim().slice(0, 500),
      answer: a.answer.trim(),
    }));
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
    .in("apply_url", postingUrls(req.job_url))
    .limit(1)
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
