import type { EmploymentType, Seniority } from "./types.ts";

/**
 * Feed track: which of the two job feeds a posting belongs in.
 *
 *   hourly        — low barrier to entry: warehouse, production, food service,
 *                   retail, janitorial, driving, front desk, call center… and
 *                   most temp assignments from staffing agencies.
 *   professional  — roles that ask for a degree, a license, years of
 *                   experience, or a salaried pay level.
 *
 * Explainable rules, no LLM: a strong title match decides on its own;
 * otherwise schedule, pay and the description's requirements are weighed.
 * Staffing agencies (company_type = staffing_agency) post both kinds, so a
 * posting with no clear signal falls back on its schedule there, while a
 * direct employer's defaults to professional.
 */

export const JOB_TRACKS = ["hourly", "professional"] as const;
export type JobTrack = (typeof JOB_TRACKS)[number];

export const JOB_TRACK_LABELS: Record<JobTrack, string> = {
  hourly: "Temp & hourly",
  professional: "Professional",
};

export const JOB_TRACK_BLURBS: Record<JobTrack, string> = {
  hourly: "Low barrier to entry: shifts, temp assignments and hourly roles. Start fast.",
  professional: "Career roles that call for a degree, license or experience.",
};

export type CompanyType = "employer" | "staffing_agency";

export type PayRange = {
  min: number | null;
  max: number | null;
  unit: "hour" | "day" | "week" | "month" | "year";
};

export type TrackInput = {
  title: string;
  description: string | null;
  employment_type: EmploymentType | null;
  seniority: Seniority;
  pay?: PayRange | null;
  companyType?: CompanyType | null;
};

// Roles that almost never ask for more than a short onboarding.
const LOW_BARRIER_TITLE =
  /\b(warehouse|forklift|reach truck|order (?:picker|selector|filler)|pickers?|packers?|pick(?:ing)? (?:and|&) pack|material handlers?|package handlers?|loaders?|unloaders?|stockers?|shipping (?:and|&) receiving|receiving (?:clerk|associate)|fulfillment|sorters?|packag(?:er|ing) (?:associate|operator|worker)|assemblers?|assembly (?:worker|associate|line)|production (?:worker|associate|operator|helper|team member)|machine operators?|line (?:worker|operator|lead)|general labou?r(?:er)?|labou?rers?|helpers?|janitors?|janitorial|custodians?|custodial|housekeep\w*|cleaners?|cleaning|dishwashers?|(?:prep|line) cooks?|cooks?|barista|servers?|bussers?|host(?:ess)?|cashiers?|crew members?|retail (?:associate|team member)|sales associates?|merchandisers?|food service|kitchen|dietary aide|delivery drivers?|drivers?|couriers?|valet|security (?:officer|guard)s?|guards?|receptionists?|front desk|data entry|mail(?:room)? clerks?|file clerks?|clerks?|call center|customer service (?:rep|representative|associate|agent)s?|event staff|ushers?|caregivers?|home health aides?|personal care aides?|landscap\w*|groundskeepers?|movers?|car wash|lot attendants?|parking attendants?|attendants?)\b/i;

// Roles that need a degree, license or a body of experience.
const PROFESSIONAL_TITLE =
  /\b(engineer(?:ing)?|developer|programmer|software|devops|architect|analyst|scientist|accountant|accounting|controller|auditor|attorney|lawyer|counsel|paralegal|manager|director|head of|vp|vice president|chief|consultant|strategist|designer|product|recruiter|talent acquisition|registered nurse|rn|nurse practitioner|lpn|pharmacist|physician|therapist|psychologist|teacher|professor|instructor|actuary|underwriter|economist|chemist|biologist|technologist|marketing|financial|finance|investment|project|program|administrator|superintendent|estimator|planner|buyer|bookkeeper|payroll|human resources|hr (?:generalist|business partner)|specialist|coordinator|supervisor|executive)\b/i;

// Title words that only make it professional when nothing low-barrier matches.
// ("Warehouse Supervisor", "Security Officer" stay hourly.)
const WEAK_PROFESSIONAL = /^(specialist|coordinator|supervisor|administrator|executive|program)$/i;

const DESCRIPTION_HOURLY: [RegExp, string][] = [
  [/\bno (?:prior )?experience (?:necessary|needed|required)\b/i, "No experience needed"],
  [/\bhigh school diploma(?: or (?:ged|equivalent))?\b|\bged\b/i, "High school diploma level"],
  [/\b(?:weekly|daily|same[- ]day) pay\b/i, "Weekly / same-day pay"],
  [/\bon[- ]the[- ]job training\b|\bwill train\b|\bpaid training\b/i, "Training provided"],
  [/\b(?:1st|2nd|3rd|first|second|third|night|weekend|graveyard|swing) shifts?\b/i, "Shift work"],
  [/\b(?:lift|carry) (?:up to )?\d{2,3} ?(?:lbs?|pounds)\b/i, "Physical role"],
  [/\bstand(?:ing)? for (?:long|extended|\d+)/i, "Physical role"],
  [/\bentry[- ]level\b/i, "Entry level"],
  [/\btemp(?:orary)?[- ]to[- ](?:hire|perm)\b/i, "Temp-to-hire"],
];

const DESCRIPTION_PROFESSIONAL: [RegExp, string][] = [
  [
    /\b(?:bachelor'?s|master'?s|mba|ph\.?d|doctorate|b\.[as]\.|m\.[as]\.)\b|\bdegree (?:in|required)\b/i,
    "Degree required",
  ],
  [/\b(?:licensed|licensure|license required|board certified|cpa|pmp|pe license)\b/i, "License"],
];

const YEARS =
  /\b(\d{1,2})\+?\s*(?:-\s*\d{1,2}\s*)?years?(?:'| of)?\s+(?:\w+\s+){0,3}experience\b/gi;

/** Hourly-equivalent rate (2,080 working hours a year). */
export function hourlyRate(pay: PayRange | null | undefined): number | null {
  if (!pay) return null;
  const v = pay.max ?? pay.min;
  if (v === null || !Number.isFinite(v) || v <= 0) return null;
  const perHour = { hour: 1, day: 8, week: 40, month: 173, year: 2080 }[pay.unit];
  return v / perHour;
}

export function classifyTrack(input: TrackInput): { track: JobTrack; reasons: string[] } {
  const title = input.title;
  const desc = input.description ?? "";

  // --- 1. Seniority and internships settle it.
  if (["senior", "lead", "executive"].includes(input.seniority))
    return { track: "professional", reasons: ["Senior-level title"] };
  if (input.employment_type === "internship")
    return { track: "professional", reasons: ["Internship on a career path"] };

  // --- 2. Title keywords. Strong professional words beat low-barrier ones
  // ("Warehouse Systems Analyst"); weak ones don't ("Warehouse Supervisor").
  const low = LOW_BARRIER_TITLE.exec(title);
  // Entry-level titles that contain a professional-sounding word.
  const entryPhrase = /\bleasing (?:agent|consultant)s?\b/i.exec(title);
  if (entryPhrase) return { track: "hourly", reasons: [`“${entryPhrase[0]}” role`] };
  const proMatches = [...title.matchAll(new RegExp(PROFESSIONAL_TITLE.source, "gi"))].map(
    (m) => m[1],
  );
  const strongPro = [...proMatches].reverse().find((w) => !WEAK_PROFESSIONAL.test(w));
  if (strongPro) return { track: "professional", reasons: [`“${strongPro}” role`] };
  if (low) return { track: "hourly", reasons: [`“${low[1]}” role`] };

  // --- 3. Weigh schedule, pay and requirements.
  let hourly = 0;
  let pro = proMatches.length ? 1 : 0;
  const reasons: { h: string[]; p: string[] } = {
    h: [],
    p: proMatches.length ? [`“${proMatches[0]}” role`] : [],
  };

  if (input.employment_type === "temporary" || input.employment_type === "part_time") {
    hourly += 2;
    reasons.h.push(input.employment_type === "temporary" ? "Temporary assignment" : "Part time");
  }

  const rate = hourlyRate(input.pay);
  const salaried = input.pay?.unit === "year" || input.pay?.unit === "month";
  if (rate !== null) {
    // A salary is itself a professional signal once it's past hourly-wage
    // territory (some agencies annualize hourly rates: "$42,224/year").
    if (salaried && rate >= 24 && rate < 40) {
      pro += 1;
      reasons.p.push(`Salaried, about $${Math.round((rate * 2080) / 1000)}K/yr`);
    } else if (rate < 28) {
      hourly += 2;
      reasons.h.push(`Pays about $${Math.round(rate)}/hr`);
    } else if (rate >= 40) {
      pro += 2;
      reasons.p.push(`Pays about $${Math.round(rate)}/hr`);
    }
  }

  for (const [rx, why] of DESCRIPTION_HOURLY)
    if (rx.test(desc) && !reasons.h.includes(why)) {
      hourly += 1;
      reasons.h.push(why);
    }
  for (const [rx, why] of DESCRIPTION_PROFESSIONAL)
    if (rx.test(desc)) {
      pro += 2;
      reasons.p.push(why);
    }
  const years = Math.max(
    0,
    ...[...desc.matchAll(YEARS)].map((m) => Number(m[1])).filter((n) => n < 30),
  );
  if (years >= 5) {
    pro += 2;
    reasons.p.push(`${years}+ years' experience`);
  } else if (years >= 2) {
    pro += 1;
    reasons.p.push(`${years}+ years' experience`);
  }

  if (hourly > pro) return { track: "hourly", reasons: reasons.h.slice(0, 3) };
  if (pro > hourly) return { track: "professional", reasons: reasons.p.slice(0, 3) };

  // --- 4. No clear signal.
  if (input.companyType === "staffing_agency" && input.employment_type !== "full_time")
    return { track: "hourly", reasons: ["Staffing agency assignment"] };
  return { track: "professional", reasons: ["Direct employer role"] };
}

/** `?track=hourly|professional|all` on the job feed routes. */
export function parseTrackSearch(s: Record<string, unknown>): {
  track?: JobTrack | "all";
} {
  const t = s.track;
  return t === "hourly" || t === "professional" || t === "all" ? { track: t } : {};
}
