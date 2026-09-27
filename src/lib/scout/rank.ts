import type { JobTrack } from "./track.ts";

/**
 * "User Feed Ranking" — orders jobs for one talent from their saved
 * preferences (position, industry / NAICS, location, employment type,
 * date posted). Pure function, shared by the talent feed and the guest
 * preview so both rank the same way.
 *
 * Also applies the "Recruiter Score": postings a Savant recruiter created
 * directly (source = manual) get a small boost over scouted listings.
 */

export type RankablePreferences = {
  positions: string[];
  industries: string[];
  naics_codes: string[];
  locations: string[];
  employment_types: string[];
  remote_ok: boolean;
  posted_within_days: number;
  /** Lowest hourly pay the talent wants; roles that meet it rank higher. */
  min_hourly_pay?: number | null;
  /** Temp partner apps (bluecrew | workwhile | instawork) the talent uses. */
  temp_apps?: string[];
};

export type RankableJob = {
  id: string;
  title: string;
  source: string;
  location: string | null;
  remote: boolean;
  industry: string | null;
  naics_code: string | null;
  employment_type: string | null;
  posted_at: string | null;
  created_at: string;
  ghost_score: number;
  /** Ratings the employer passed (JUST Capital / As You Sow), set by the scout. */
  employer_badges?: string[];
  /** Feed track from the scout's classifier, and a manual override of it. */
  track?: string | null;
  track_override?: string | null;
  pay_min?: number | null;
  pay_max?: number | null;
  pay_unit?: string | null;
};

const PER_HOUR: Record<string, number> = { hour: 1, day: 8, week: 40, month: 173, year: 2080 };

/**
 * Top of the posted pay range as an hourly rate. Null when there's no pay,
 * or it's a flat per-shift rate (shift length isn't known).
 */
export function hourlyPay(j: Pick<RankableJob, "pay_min" | "pay_max" | "pay_unit">): number | null {
  const v = j.pay_max ?? j.pay_min;
  const per = PER_HOUR[j.pay_unit ?? ""];
  return v === null || v === undefined || !per ? null : Number(v) / per;
}

/** The feed a posting shows in: the override when someone set one, else the classifier's. */
export function effectiveTrack(j: Pick<RankableJob, "track" | "track_override">): JobTrack {
  return (j.track_override ?? j.track) === "hourly" ? "hourly" : "professional";
}

export type TrackFilter = JobTrack | "all";

export type RankedJob<J extends RankableJob> = J & { match: number; matchReasons: string[] };

const STOP = new Set([
  "and",
  "or",
  "the",
  "of",
  "a",
  "an",
  "to",
  "in",
  "for",
  "with",
  "i",
  "ii",
  "iii",
  "sr",
  "jr",
]);
const tokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));

function positionScore(title: string, positions: string[]): number {
  if (positions.length === 0) return 0;
  const titleTokens = new Set(tokens(title));
  let best = 0;
  for (const p of positions) {
    const want = tokens(p);
    if (want.length === 0) continue;
    const hit = want.filter((t) => titleTokens.has(t)).length / want.length;
    best = Math.max(best, hit);
  }
  return best;
}

export function jobAgeDays(
  job: Pick<RankableJob, "posted_at" | "created_at">,
  now = Date.now(),
): number {
  return (now - new Date(job.posted_at ?? job.created_at).getTime()) / 86_400_000;
}

export function rankJobs<J extends RankableJob>(
  jobs: J[],
  prefs: RankablePreferences | null,
  now = Date.now(),
): RankedJob<J>[] {
  const ranked = jobs.map((job) => {
    const reasons: string[] = [];
    let score = 0;

    const age = jobAgeDays(job, now);
    const window = prefs?.posted_within_days ?? 30;
    score += Math.max(0, 10 * (1 - age / Math.max(window, 1)));

    if (job.employer_badges?.length) {
      score += 6;
      reasons.push("Highly rated employer");
    }

    if (job.source === "manual") {
      score += 8;
      reasons.push("Posted by a Savant recruiter");
    }
    score -= job.ghost_score / 5;

    if (prefs) {
      const pos = positionScore(job.title, prefs.positions);
      if (pos > 0) {
        score += 40 * pos;
        reasons.push(pos === 1 ? "Matches your target role" : "Similar to your target role");
      }

      const loc = (job.location ?? "").toLowerCase();
      if (prefs.locations.some((l) => l.trim() && loc.includes(l.trim().toLowerCase()))) {
        score += 20;
        reasons.push("In your preferred location");
      } else if (job.remote && prefs.remote_ok) {
        score += 15;
        reasons.push("Remote");
      }

      const rate = hourlyPay(job);
      if (prefs.min_hourly_pay && rate !== null && rate >= prefs.min_hourly_pay) {
        score += 10;
        reasons.push("Meets your pay");
      }

      if (prefs.temp_apps?.includes(job.source)) {
        score += 8;
        reasons.push("On an app you use");
      }

      if (job.employment_type && prefs.employment_types.includes(job.employment_type)) {
        score += 15;
        reasons.push("Your preferred schedule");
      }

      const industryHit =
        (job.naics_code &&
          prefs.naics_codes.some(
            (c) => job.naics_code!.startsWith(c) || c.startsWith(job.naics_code!),
          )) ||
        (job.industry &&
          prefs.industries.some((i) => job.industry!.toLowerCase().includes(i.toLowerCase())));
      if (industryHit) {
        score += 10;
        reasons.push("In your industry");
      }
    }

    return { ...job, match: Math.round(score), matchReasons: reasons };
  });
  return ranked.sort((a, b) => b.match - a.match || jobAgeDays(a, now) - jobAgeDays(b, now));
}

/** The hard filters behind "Refine parameters" on the feed. */
export type FeedFilters = {
  /** Temp & hourly feed, professional feed, or both. */
  track: TrackFilter;
  q: string;
  location: string;
  employmentTypes: string[];
  naics: string;
  postedWithinDays: number | null;
  remoteOnly: boolean;
  /** Hourly pay floor; roles without an hourly-comparable rate are hidden while set. */
  minPay: number | null;
  /** Temp partner apps to show (by job source); empty = all. */
  tempApps: string[];
};

export const EMPTY_FILTERS: FeedFilters = {
  track: "all",
  q: "",
  location: "",
  employmentTypes: [],
  naics: "",
  postedWithinDays: null,
  remoteOnly: false,
  minPay: null,
  tempApps: [],
};

export function applyFilters<J extends RankableJob & { company_name?: string | null }>(
  jobs: J[],
  f: FeedFilters,
  now = Date.now(),
): J[] {
  const q = f.q.trim().toLowerCase();
  const loc = f.location.trim().toLowerCase();
  return jobs.filter((j) => {
    if (f.track !== "all" && effectiveTrack(j) !== f.track) return false;
    if (q && !`${j.title} ${j.company_name ?? ""}`.toLowerCase().includes(q)) return false;
    if (loc && !(j.location ?? "").toLowerCase().includes(loc) && !(loc === "remote" && j.remote))
      return false;
    if (f.employmentTypes.length && !f.employmentTypes.includes(j.employment_type ?? ""))
      return false;
    if (f.naics && !(j.naics_code ?? "").startsWith(f.naics)) return false;
    if (f.postedWithinDays !== null && jobAgeDays(j, now) > f.postedWithinDays) return false;
    if (f.remoteOnly && !j.remote) return false;
    if (f.minPay !== null) {
      const rate = hourlyPay(j);
      if (rate === null || rate < f.minPay) return false;
    }
    // App filter narrows the temp side only; it never empties the professional feed.
    if (f.tempApps.length && f.track !== "professional" && !f.tempApps.includes(j.source))
      return false;
    return true;
  });
}
