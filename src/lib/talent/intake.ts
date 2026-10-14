/**
 * Talent intake: ZIP → state and metro, travel areas, and availability.
 *
 * Distance is approximate by design: no coordinates, just areas. Up to 25
 * or 50 miles means the talent's metro area (one of the metros in
 * src/lib/scout/location.ts); up to 100 miles means their state; no limit
 * means anywhere. Talent outside a known metro fall back to their state.
 */
import { METROS } from "../scout/location.ts";
import { locationMatches } from "../scout/search.ts";
import { POSITION_LABELS, type PositionType } from "../scout/position.ts";
import { NAICS_SECTOR_OPTIONS } from "../scout/refine.ts";

// ---------------------------------------------------------------------------
// ZIP → state (USPS three-digit prefixes)
// ---------------------------------------------------------------------------

const STATE_RANGES: [number, number, string][] = [
  [5, 5, "NY"],
  [6, 9, "PR"],
  [10, 27, "MA"],
  [28, 29, "RI"],
  [30, 38, "NH"],
  [39, 49, "ME"],
  [50, 59, "VT"],
  [60, 69, "CT"],
  [70, 89, "NJ"],
  [100, 149, "NY"],
  [150, 196, "PA"],
  [197, 199, "DE"],
  [200, 200, "DC"],
  [201, 201, "VA"],
  [202, 205, "DC"],
  [206, 219, "MD"],
  [220, 246, "VA"],
  [247, 268, "WV"],
  [270, 289, "NC"],
  [290, 299, "SC"],
  [300, 319, "GA"],
  [320, 349, "FL"],
  [350, 369, "AL"],
  [370, 385, "TN"],
  [386, 397, "MS"],
  [398, 399, "GA"],
  [400, 427, "KY"],
  [430, 458, "OH"],
  [460, 479, "IN"],
  [480, 499, "MI"],
  [500, 528, "IA"],
  [530, 549, "WI"],
  [550, 567, "MN"],
  [569, 569, "DC"],
  [570, 577, "SD"],
  [580, 588, "ND"],
  [590, 599, "MT"],
  [600, 629, "IL"],
  [630, 658, "MO"],
  [660, 679, "KS"],
  [680, 693, "NE"],
  [700, 714, "LA"],
  [716, 729, "AR"],
  [730, 732, "OK"],
  [733, 733, "TX"],
  [734, 749, "OK"],
  [750, 799, "TX"],
  [800, 816, "CO"],
  [820, 831, "WY"],
  [832, 838, "ID"],
  [840, 847, "UT"],
  [850, 865, "AZ"],
  [870, 884, "NM"],
  [885, 885, "TX"],
  [889, 898, "NV"],
  [900, 961, "CA"],
  [967, 968, "HI"],
  [970, 979, "OR"],
  [980, 994, "WA"],
  [995, 999, "AK"],
];

// ZIP prefixes for each metro in location.ts (approximate, core counties).
const METRO_PREFIXES: [string, [number, number][]][] = [
  [
    "New York–Newark–Jersey City",
    [
      [100, 119],
      [70, 76],
    ],
  ],
  [
    "Portland–Eugene",
    [
      [970, 974],
      [986, 986],
    ],
  ],
  [
    "Los Angeles–Long Beach–Anaheim",
    [
      [900, 918],
      [926, 928],
    ],
  ],
  [
    "San Francisco–Oakland–Berkeley",
    [
      [940, 941],
      [943, 951],
    ],
  ],
  ["Riverside–San Bernardino–Ontario", [[922, 925]]],
  ["San Diego–Chula Vista–Carlsbad", [[919, 921]]],
  ["Chicago–Naperville–Elgin", [[600, 608]]],
  [
    "Dallas–Fort Worth–Arlington",
    [
      [750, 753],
      [760, 762],
    ],
  ],
  ["Houston–Pasadena–The Woodlands", [[770, 775]]],
  [
    "Washington–Arlington–Alexandria",
    [
      [200, 209],
      [220, 223],
    ],
  ],
  ["Miami–Fort Lauderdale–West Palm Beach", [[330, 334]]],
  [
    "Philadelphia–Camden–Wilmington",
    [
      [190, 191],
      [80, 83],
      [197, 198],
    ],
  ],
  ["Atlanta–Sandy Springs–Roswell", [[300, 303]]],
  ["Boston–Cambridge–Newton", [[18, 24]]],
  ["Phoenix–Mesa–Chandler", [[850, 853]]],
  ["Detroit–Warren–Dearborn", [[480, 483]]],
  ["Seattle–Tacoma–Bellevue", [[980, 984]]],
  [
    "Minneapolis–St. Paul–Bloomington",
    [
      [550, 551],
      [553, 554],
    ],
  ],
  [
    "Tampa–St. Petersburg–Clearwater",
    [
      [335, 337],
      [346, 346],
    ],
  ],
  ["Denver–Aurora–Lakewood", [[800, 806]]],
  [
    "Orlando–Kissimmee–Sanford",
    [
      [327, 328],
      [347, 347],
    ],
  ],
];

export type ZipArea = { state: string | null; metro: string | null };

export function zipArea(zip: string): ZipArea {
  if (!/^\d{5}$/.test(zip)) return { state: null, metro: null };
  const p = Number(zip.slice(0, 3));
  const state = STATE_RANGES.find(([a, b]) => p >= a && p <= b)?.[2] ?? null;
  const metro =
    METRO_PREFIXES.find(([, ranges]) => ranges.some(([a, b]) => p >= a && p <= b))?.[0] ?? null;
  return { state, metro };
}

// ---------------------------------------------------------------------------
// Travel areas
// ---------------------------------------------------------------------------

export const TRAVEL_OPTIONS: { miles: number | null; label: string; hint: string }[] = [
  { miles: 25, label: "Up to 25 miles", hint: "Jobs in your metro area" },
  { miles: 50, label: "Up to 50 miles", hint: "Jobs in your metro area" },
  { miles: 100, label: "Up to 100 miles", hint: "Jobs anywhere in your state" },
  { miles: null, label: "Anywhere", hint: "Open to relocating or travelling" },
];

export type TravelArea = { miles: number | null; state: string | null; metro: string | null };

/** Whether a job is within the talent's travel area. Remote jobs always are. */
export function inTravelArea(
  location: string | null | undefined,
  remote: boolean,
  area: TravelArea | null,
): boolean {
  if (!area || area.miles === null || remote) return true;
  if (!location) return false;
  if (area.miles <= 50 && area.metro) {
    const metro = METROS.find((m) => m.name === area.metro);
    if (metro) return metro.match.test(location.replace(/\./g, ""));
  }
  return area.state ? locationMatches(location, area.state) : true;
}

/** "your metro area (San Francisco–Oakland–Berkeley)" / "CA" / "anywhere". */
export function describeArea(area: TravelArea | null): string {
  if (!area || area.miles === null) return "anywhere";
  if (area.miles <= 50 && area.metro) return `the ${area.metro} area`;
  return area.state ? `${area.state}` : "anywhere";
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABEL: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export type Slot = { start: string; end: string } | null;
export type Availability = Record<Day, Slot>;

export const EMPTY_AVAILABILITY: Availability = {
  mon: null,
  tue: null,
  wed: null,
  thu: null,
  fri: null,
  sat: null,
  sun: null,
};

/** Half-hour steps from 5:00 to 23:30, as "HH:MM". */
export const TIMES = Array.from({ length: 38 }, (_, i) => {
  const mins = 5 * 60 + i * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
});

export const timeLabel = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
};

export const PRESETS: { label: string; days: Day[]; start: string; end: string }[] = [
  {
    label: "Weekdays 9–5",
    days: ["mon", "tue", "wed", "thu", "fri"],
    start: "09:00",
    end: "17:00",
  },
  {
    label: "Weekday evenings",
    days: ["mon", "tue", "wed", "thu", "fri"],
    start: "17:00",
    end: "22:00",
  },
  { label: "Weekends", days: ["sat", "sun"], start: "09:00", end: "17:00" },
  { label: "Any day", days: [...DAYS], start: "06:00", end: "22:00" },
];

/** "Mon–Fri 9am–5pm, Sat 10am–2pm" for summaries. */
export function summarizeAvailability(a: Partial<Availability> | null | undefined): string {
  if (!a) return "Not given";
  const groups: { days: Day[]; slot: string }[] = [];
  for (const d of DAYS) {
    const s = a[d];
    if (!s) continue;
    const slot = `${timeLabel(s.start)}–${timeLabel(s.end)}`;
    const last = groups[groups.length - 1];
    const prevDay = last ? DAYS[DAYS.indexOf(last.days[last.days.length - 1]) + 1] : null;
    if (last && last.slot === slot && prevDay === d) last.days.push(d);
    else groups.push({ days: [d], slot });
  }
  if (!groups.length) return "Not given";
  const short = (d: Day) => DAY_LABEL[d].slice(0, 3);
  return groups
    .map(
      (g) =>
        `${g.days.length > 2 ? `${short(g.days[0])}–${short(g.days[g.days.length - 1])}` : g.days.map(short).join(", ")} ${g.slot}`,
    )
    .join("; ");
}

// ---------------------------------------------------------------------------
// Summary for coaches and admins
// ---------------------------------------------------------------------------

export type IntakeRow = {
  intake_industry: string | null;
  intake_industry_other: string | null;
  intake_role: string | null;
  intake_role_other: string | null;
  home_zip: string | null;
  home_state: string | null;
  home_metro: string | null;
  travel_miles: number | null;
  remote_ok: boolean;
  availability: unknown;
  intake_completed_at: string | null;
};

/** The intake as plain-language answers, for coach and admin views. */
export function intakeSummary(p: IntakeRow) {
  const industry =
    p.intake_industry === "other"
      ? (p.intake_industry_other ?? "Other")
      : (NAICS_SECTOR_OPTIONS.find((o) => o.code === p.intake_industry)?.label ?? null);
  const role =
    p.intake_role === "other"
      ? (p.intake_role_other ?? "Other")
      : (POSITION_LABELS[p.intake_role as PositionType] ?? null);
  const where = [p.home_metro, p.home_state].filter(Boolean).join(", ");
  const travel =
    p.travel_miles === null
      ? "Anywhere"
      : `Up to ${p.travel_miles} miles (${describeArea({ miles: p.travel_miles, state: p.home_state, metro: p.home_metro })})`;
  return {
    industry,
    role,
    home: p.home_zip ? `${p.home_zip}${where ? ` · ${where}` : ""}` : null,
    travel: `${travel}${p.remote_ok ? " · open to remote" : ""}`,
    availability: summarizeAvailability(p.availability as Partial<Availability> | null),
  };
}
