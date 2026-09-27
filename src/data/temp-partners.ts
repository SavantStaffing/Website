/**
 * Temporary-staffing partner platforms, and what's available on them.
 *
 * Positions, companies, activity and pay are derived from the open listings
 * in temp-listings.ts, the same data that fills the Temp & hourly job feed,
 * so updating that file updates both. The pages at /temporary-staffing
 * (informative) and /talent/temporary-work (with sign-up links) render from it.
 *
 * To add a logo: put the file in src/assets/partners/ and import it below,
 * e.g. `import bluecrewLogo from "@/assets/partners/bluecrew.svg";` then set
 * `logo: bluecrewLogo`. Without one, the partner's name is shown instead.
 */

import {
  LISTINGS,
  LISTINGS_AS_OF,
  PARTNER_NAMES,
  PARTNER_SIGNUP_URLS,
  type PartnerId,
  type TempListing,
} from "./temp-listings";

export type ActivityLevel = "high" | "medium" | "low";

export type PartnerPosition = {
  /** Position type, e.g. "Warehouse Associate". */
  title: string;
  /** Companies actively hiring for it on this platform. */
  companies: string[];
  /** How often shifts for this position come up, from the shifts listed. */
  activity: ActivityLevel;
  /** Pay range in USD, per hour or (flat-rate gigs) per shift. */
  payMin: number;
  payMax: number;
  payUnit: "hour" | "shift";
  /** Requirements any listing of this type asks for. */
  requirements: string[];
};

/** Broad overview of what's on a platform right now. */
export type PartnerSnapshot = {
  listings: number;
  companies: string[];
  cities: string[];
  /** Hourly pay range across hourly listings. */
  hourlyMin: number | null;
  hourlyMax: number | null;
  /** Flat per-shift pay range, when the platform has flat-rate gigs. */
  flatMin: number | null;
  flatMax: number | null;
  /** Industries (NAICS sectors) the listings fall in. */
  naics: string[];
  requirements: string[];
  tags: string[];
};

export type TempPartner = {
  id: PartnerId;
  name: string;
  logo?: string;
  /** One line on what the platform is. */
  tagline: string;
  /** Key facts on how it operates (employment type, pay timing, onboarding…). */
  howItWorks: string[];
  /** Where talent create their worker account. */
  signupUrl: string;
  positions: PartnerPosition[];
  snapshot: PartnerSnapshot;
};

/** When the position data below was last gathered (YYYY-MM-DD), shown on the page. */
export const TEMP_DATA_AS_OF: string | null = LISTINGS_AS_OF;

const uniq = <T>(xs: T[]) => [...new Set(xs)];
const shiftCount = (ls: TempListing[]) => ls.reduce((n, l) => n + l.shifts.length, 0);

function activityOf(ls: TempListing[]): ActivityLevel {
  const shifts = shiftCount(ls);
  return shifts >= 5 || ls.length >= 3 ? "high" : shifts >= 2 ? "medium" : "low";
}

function positionsFor(partner: PartnerId): PartnerPosition[] {
  const byType = new Map<string, TempListing[]>();
  for (const l of LISTINGS.filter((x) => x.partner === partner))
    byType.set(l.type, [...(byType.get(l.type) ?? []), l]);
  return [...byType.entries()]
    .map(([title, ls]) => ({
      title,
      companies: uniq(ls.map((l) => l.company)),
      activity: activityOf(ls),
      payMin: Math.min(...ls.map((l) => l.pay.min)),
      payMax: Math.max(...ls.map((l) => l.pay.max)),
      payUnit: ls[0].pay.unit,
      requirements: uniq(ls.flatMap((l) => l.requirements)),
    }))
    .sort((a, b) => shiftRank(b) - shiftRank(a) || a.title.localeCompare(b.title));
}
const RANK: Record<ActivityLevel, number> = { high: 3, medium: 2, low: 1 };
const shiftRank = (p: PartnerPosition) => RANK[p.activity];

function snapshotFor(partner: PartnerId): PartnerSnapshot {
  const ls = LISTINGS.filter((x) => x.partner === partner);
  const hourly = ls.filter((l) => l.pay.unit === "hour");
  const flat = ls.filter((l) => l.pay.unit === "shift");
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([x]) => x);
  };
  return {
    listings: ls.length,
    companies: uniq(ls.map((l) => l.company)),
    cities: count(ls.map((l) => l.location)),
    hourlyMin: hourly.length ? Math.min(...hourly.map((l) => l.pay.min)) : null,
    hourlyMax: hourly.length ? Math.max(...hourly.map((l) => l.pay.max)) : null,
    flatMin: flat.length ? Math.min(...flat.map((l) => l.pay.min)) : null,
    flatMax: flat.length ? Math.max(...flat.map((l) => l.pay.max)) : null,
    naics: count(ls.map((l) => l.naics)),
    requirements: count(ls.flatMap((l) => l.requirements)),
    tags: count(ls.flatMap((l) => l.tags)),
  };
}

export const TEMP_PARTNERS: TempPartner[] = [
  {
    id: "bluecrew",
    name: PARTNER_NAMES.bluecrew,
    tagline: "Flexible hourly work, now part of Employbridge.",
    howItWorks: [
      "Recurring shifts with set days and hours, like weekend warehouse nights or weekday lunch service.",
      "Some roles include a short interview before you're booked; each listing says whether one is needed.",
      "Listings name what you'll need up front, such as a driver's license or a food handler card.",
    ],
    signupUrl: PARTNER_SIGNUP_URLS.bluecrew,
    positions: positionsFor("bluecrew"),
    snapshot: snapshotFor("bluecrew"),
  },
  {
    id: "workwhile",
    name: PARTNER_NAMES.workwhile,
    tagline: "Hourly shifts matched to your skills and schedule.",
    howItWorks: [
      "Individual dated shifts, often at event venues and commercial kitchens, booked one at a time.",
      "Delivery gigs pay a flat rate per shift and need your own insured vehicle.",
      "Some shifts add a bonus on top of the hourly rate.",
    ],
    signupUrl: PARTNER_SIGNUP_URLS.workwhile,
    positions: positionsFor("workwhile"),
    snapshot: snapshotFor("workwhile"),
  },
  {
    id: "instawork",
    name: PARTNER_NAMES.instawork,
    tagline: "Pick up shifts at local businesses on your own schedule.",
    howItWorks: [
      "The widest mix of shifts: stadium concessions, events, warehouses, driving, data collection and paid research studies.",
      "Many employers post several short shifts a day, so you can fit work around other commitments.",
      "Listings are labeled Long-term, Multi-day or Trial shift, and some add tips, bonuses or paid backup shifts.",
    ],
    signupUrl: PARTNER_SIGNUP_URLS.instawork,
    positions: positionsFor("instawork"),
    snapshot: snapshotFor("instawork"),
  },
];

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  high: "High activity",
  medium: "Moderate activity",
  low: "Occasional",
};
