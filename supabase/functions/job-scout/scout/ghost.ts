// Generated from src/lib/scout/ghost.ts by scripts/build-scout-function.mjs. Do not edit.
/**
 * Ghost Job Detector v2.
 *
 * Scores how likely a posting is to be a "ghost job" — listed with no real
 * intent to hire soon (evergreen pipelines, stale reqs, endless reposts).
 * Each signal adds points; ≥ GHOST_FLAG_THRESHOLD hides the posting from
 * feeds and puts it in the admin review queue on /admin/scout, where an
 * admin can override it.
 *
 * Signals are deliberately explainable: every point comes with a reason
 * string that's stored on the job and shown to the admin.
 */

export const GHOST_FLAG_THRESHOLD = 50;

export type GhostInput = {
  title: string;
  description: string | null;
  /** false when the source's list endpoint never includes descriptions (SmartRecruiters). */
  descriptionAvailable: boolean;
  location: string | null;
  posted_at: string | null;
  /** When Savant first saw this exact posting (existing row), else now. */
  first_seen_at: string | null;
  /** How many *other* live postings share this company+title+location fingerprint. */
  sameFingerprintOthers: number;
  now?: Date;
};

const EVERGREEN =
  /\b(talent (pool|community|network|pipeline)|general (application|interest)|future (opportunit|opening|role)|expression of interest|always (hiring|accepting)|evergreen|open application|speculative application|join our (talent|pipeline))\b/i;
const VAGUE_TITLE =
  /^(various|multiple|several|open)\b.*\b(positions?|roles?|openings?)\b|^(general|open) application$/i;

/**
 * Scam / predatory-language patterns, adapted from ghost-job-detector
 * (https://github.com/Farhan89082/ghost-job-detector, MIT, detector.py
 * SCAM_PATTERNS), scored the same way: 8 points a hit, capped at 25.
 *
 * Tightened for Savant's postings, where the originals misfired:
 *   - bare "no experience necessary" dropped (normal in legitimate entry-level
 *     warehouse/staffing ads); the "work from home + no experience" combo stays
 *   - "pyramid" → "pyramid scheme" ("test pyramid" is an engineering term)
 *   - "multi-level" → "multi-level marketing" ("multi-level caching" etc.)
 *
 * One deliberate difference: patterns marked `extractsMoney` (the posting
 * asks the applicant for money or banking details) flag the job on their own.
 * Upstream caps scam language at 25 points, which would let an obvious
 * scam through to talent feeds.
 */
export const SCAM_PATTERNS: [RegExp, string, extractsMoney?: true][] = [
  [/unlimited\s+earning\s+potential/i, "Promises unlimited earnings"],
  [/be\s+your\s+own\s+boss/i, "MLM-style language"],
  [/must\s+pay\s+for\s+training/i, "Requires payment for training", true],
  [/work\s+from\s+home.{0,20}no\s+experience/i, "Work from home + no experience"],
  [/guaranteed\s+(income|salary|pay)/i, "Guarantees income"],
  [/investment\s+required/i, "Requires personal investment", true],
  [/multi.?level\s+marketing/i, "MLM indicator"],
  [/pyramid\s+scheme/i, "Pyramid scheme language"],
  [/\$\d{3,}[,\s]*per\s+day/i, "Unrealistic daily pay claim"],
  [/\bact\s+now\b/i, "Pressure language"],
  [/wire\s+transfer/i, "Wire transfer mention", true],
  [/send\s+us\s+your\s+(bank|account)/i, "Requests banking info", true],
  [/processing\s+fee/i, "Charges a processing fee", true],
  [/earn\s+\$\d+\s*(k|,000)?\s*per\s+week/i, "Unrealistic weekly earnings"],
  [/no\s+interview\s+required/i, "No interview required"],
  [/immediate\s+start\s*,?\s*no\s+interview/i, "Immediate hire, no interview"],
  [/re.?ship(ping)?\s+coordinator/i, "Reshipping scam indicator", true],
];

const DAY = 86_400_000;

export function scoreGhost(input: GhostInput): { score: number; reasons: string[] } {
  const now = (input.now ?? new Date()).getTime();
  const reasons: string[] = [];
  let score = 0;
  const add = (pts: number, reason: string) => {
    score += pts;
    reasons.push(reason);
  };

  if (input.posted_at) {
    const ageDays = (now - new Date(input.posted_at).getTime()) / DAY;
    // Over a year open is enough on its own to hold a posting for review.
    if (ageDays > 365) add(GHOST_FLAG_THRESHOLD, `Posted ${Math.round(ageDays)} days ago`);
    else if (ageDays > 120) add(40, `Posted ${Math.round(ageDays)} days ago`);
    else if (ageDays > 60) add(25, `Posted ${Math.round(ageDays)} days ago`);
  }

  if (input.first_seen_at) {
    const listedDays = (now - new Date(input.first_seen_at).getTime()) / DAY;
    if (listedDays > 90) add(15, `Still listed after ${Math.round(listedDays)} days of tracking`);
  }

  const text = `${input.title}\n${input.description ?? ""}`;
  if (EVERGREEN.test(text)) add(35, "Evergreen / talent-pipeline language");
  if (VAGUE_TITLE.test(input.title.trim())) add(20, "Non-specific title");

  const scamHits = SCAM_PATTERNS.filter(([rx]) => rx.test(text));
  if (scamHits.length) {
    const labels = scamHits.map(([, label]) => label).join(", ");
    if (scamHits.some(([, , extractsMoney]) => extractsMoney)) {
      add(
        GHOST_FLAG_THRESHOLD,
        `Likely scam — asks applicants for money or banking details: ${labels}`,
      );
    } else {
      add(Math.min(25, 8 * scamHits.length), `Suspicious language: ${labels}`);
    }
  }

  if (input.descriptionAvailable) {
    const len = input.description?.trim().length ?? 0;
    if (len === 0) add(20, "No description");
    else if (len < 300) add(10, "Very short description");
  }

  if (input.sameFingerprintOthers > 0) {
    add(
      Math.min(30, 15 + 5 * input.sameFingerprintOthers),
      `Reposted ${input.sameFingerprintOthers + 1}× under different IDs`,
    );
  }

  if (!input.location) add(5, "No location");

  return { score: Math.min(100, score), reasons };
}
