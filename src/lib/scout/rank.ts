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
};

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
  q: string;
  location: string;
  employmentTypes: string[];
  naics: string;
  postedWithinDays: number | null;
  remoteOnly: boolean;
};

export const EMPTY_FILTERS: FeedFilters = {
  q: "",
  location: "",
  employmentTypes: [],
  naics: "",
  postedWithinDays: null,
  remoteOnly: false,
};

export function applyFilters<J extends RankableJob & { company_name?: string | null }>(
  jobs: J[],
  f: FeedFilters,
  now = Date.now(),
): J[] {
  const q = f.q.trim().toLowerCase();
  const loc = f.location.trim().toLowerCase();
  return jobs.filter((j) => {
    if (q && !`${j.title} ${j.company_name ?? ""}`.toLowerCase().includes(q)) return false;
    if (loc && !(j.location ?? "").toLowerCase().includes(loc) && !(loc === "remote" && j.remote))
      return false;
    if (f.employmentTypes.length && !f.employmentTypes.includes(j.employment_type ?? ""))
      return false;
    if (f.naics && !(j.naics_code ?? "").startsWith(f.naics)) return false;
    if (f.postedWithinDays !== null && jobAgeDays(j, now) > f.postedWithinDays) return false;
    if (f.remoteOnly && !j.remote) return false;
    return true;
  });
}
