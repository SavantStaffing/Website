/**
 * Open listings on the temp partner apps, from "Temp Job Directory.xlsx"
 * (gathered 2026-09-27). This one file feeds both:
 *
 *   - the Temp & hourly job feed: `node scripts/temp-listings-sql.ts` turns
 *     it into SQL that upserts these into public.jobs (source = the partner)
 *     and closes listings that are no longer here;
 *   - the partner overviews on /temporary-staffing (see temp-partners.ts).
 *
 * To refresh: replace LISTINGS with the new sheet's rows, update
 * LISTINGS_AS_OF, then regenerate and apply the SQL.
 */

export const PARTNER_IDS = ["bluecrew", "workwhile", "instawork"] as const;
export type PartnerId = (typeof PARTNER_IDS)[number];

export const PARTNER_NAMES: Record<PartnerId, string> = {
  bluecrew: "Bluecrew",
  workwhile: "WorkWhile",
  instawork: "Instawork",
};

/** Where talent create their worker account; also each listing's apply link. */
export const PARTNER_SIGNUP_URLS: Record<PartnerId, string> = {
  bluecrew: "https://www.bluecrewjobs.com/",
  workwhile: "https://www.workwhile.ai/for-workers",
  instawork: "https://www.instawork.com/worker",
};

export type TempListing = {
  partner: PartnerId;
  company: string;
  /** Title as the app lists it. */
  position: string;
  /** Position type it's grouped under on the overview. */
  type: string;
  location: string;
  requirements: string[];
  /** App labels such as "Long-Term", "Multi-Day", "Tips". */
  tags: string[];
  /** Shifts as listed, one per line. */
  shifts: string[];
  pay: { min: number; max: number; unit: "hour" | "shift"; note?: string };
  /** Bluecrew lists whether an interview is needed. */
  interview?: boolean;
  /** NAICS sector for the industry filter and preference matching. */
  naics: "44" | "48" | "54" | "56" | "71" | "72";
};

/** YYYY-MM-DD the listings were gathered. */
export const LISTINGS_AS_OF = "2026-09-27";

/** Listings stay in the feed this many days after LISTINGS_AS_OF unless refreshed. */
export const LISTINGS_VALID_DAYS = 14;

export const LISTINGS: TempListing[] = [
  // ------------------------------------------------------------ Bluecrew
  {
    partner: "bluecrew",
    company: "Collision Auto Parts",
    position: "Driver",
    type: "Driver",
    location: "Hayward, CA",
    requirements: ["Driver's license"],
    tags: [],
    shifts: ["Flexible (as needed)"],
    pay: { min: 21, max: 21, unit: "hour" },
    interview: true,
    naics: "48",
  },
  {
    partner: "bluecrew",
    company: "Jitsu",
    position: "Warehouse Associate",
    type: "Warehouse Associate",
    location: "San Leandro, CA",
    requirements: ["Physical labor"],
    tags: [],
    shifts: ["Saturday + Sunday, 5:30pm – 11:30pm"],
    pay: { min: 18, max: 18, unit: "hour" },
    interview: false,
    naics: "48",
  },
  {
    partner: "bluecrew",
    company: "Sharebite",
    position: "Server",
    type: "Server",
    location: "San Francisco, CA",
    requirements: ["Food handler card"],
    tags: [],
    shifts: ["Monday – Thursday, 11:00am – 3:00pm"],
    pay: { min: 26, max: 26, unit: "hour" },
    interview: true,
    naics: "72",
  },

  // ------------------------------------------------------------ WorkWhile
  {
    partner: "workwhile",
    company: "Advantage Solutions",
    position: "Costco Sample Demonstrator",
    type: "Sample Demonstrator",
    location: "Newark, CA",
    requirements: ["Food handler card", "Experience needed"],
    tags: [],
    shifts: ["Sun 9/27, 10:00am – 4:15pm"],
    pay: { min: 20.37, max: 20.37, unit: "hour" },
    naics: "44",
  },
  {
    partner: "workwhile",
    company: "Jitsu",
    position: "Delivery Driver",
    type: "Delivery Driver",
    location: "San Leandro, CA",
    requirements: ["Driver's license", "Insurance", "Own vehicle", "Heavy lifting"],
    tags: ["Flat rate"],
    shifts: [
      "Sun 9/27, 11:00am – 3:00pm",
      "Sun 9/27, 1:00pm – 5:00pm",
      "Sun 9/27, 2:00pm – 6:00pm",
    ],
    pay: { min: 110, max: 110, unit: "shift", note: "$110 flat per shift" },
    naics: "48",
  },
  {
    partner: "workwhile",
    company: "Jitsu",
    position: "Delivery Driver (flat rate)",
    type: "Delivery Driver",
    location: "South San Francisco, CA",
    requirements: ["Driver's license", "Insurance", "Own vehicle", "Heavy lifting"],
    tags: ["Flat rate", "Bonus"],
    shifts: ["Sun 9/27, 10:00am – 2:00pm", "Sun 9/27, 2:00pm – 6:00pm"],
    pay: {
      min: 95,
      max: 109,
      unit: "shift",
      note: "$95 flat (10am shift); $109 + $14.25 bonus (2pm shift)",
    },
    naics: "48",
  },
  {
    partner: "workwhile",
    company: "Santa Clara Convention Center",
    position: "General Labor",
    type: "General Labor",
    location: "Santa Clara, CA",
    requirements: ["English proficiency", "Heavy lifting"],
    tags: [],
    shifts: ["Sat 9/26, 2:30pm – 11:00pm"],
    pay: { min: 22, max: 22, unit: "hour" },
    naics: "71",
  },
  {
    partner: "workwhile",
    company: "Shoreline Amphitheatre",
    position: "Prep Cook",
    type: "Prep Cook",
    location: "Mountain View, CA",
    requirements: ["Food handler card"],
    tags: ["Bonus"],
    shifts: ["Sat 9/26, 2:00pm – 11:30pm", "Sat 10/3, 1:30pm – 11:00pm"],
    pay: { min: 23, max: 23, unit: "hour", note: "$23/hr, plus a $75 bonus on 9/26" },
    naics: "72",
  },
  {
    partner: "workwhile",
    company: "Shoreline Amphitheatre",
    position: "Dishwasher",
    type: "Dishwasher",
    location: "Mountain View, CA",
    requirements: ["Experience needed"],
    tags: [],
    shifts: ["Sat 10/3, 5:00pm – 12:00am"],
    pay: { min: 22, max: 22, unit: "hour" },
    naics: "72",
  },
  {
    partner: "workwhile",
    company: "Thistle",
    position: "Prep Cook – Kitchen Experience",
    type: "Prep Cook",
    location: "Vacaville, CA",
    requirements: ["Experience needed", "English proficiency", "Heavy lifting"],
    tags: [],
    shifts: ["Sat 9/26 + Sat 10/3, 2:30pm – 11:00pm"],
    pay: { min: 20, max: 20, unit: "hour" },
    naics: "72",
  },
  {
    partner: "workwhile",
    company: "Thistle",
    position: "Dishwasher",
    type: "Dishwasher",
    location: "Vacaville, CA",
    requirements: ["Heavy lifting"],
    tags: [],
    shifts: ["Sat 9/26, 2:30pm – 11:00pm", "Sat 9/26, 10:30pm – 6:00am"],
    pay: { min: 20, max: 21, unit: "hour", note: "$20/hr (2:30pm shift); $21/hr (10:30pm shift)" },
    naics: "72",
  },

  // ------------------------------------------------------------ Instawork
  {
    partner: "instawork",
    company: "Azazie",
    position: "Event Setup and Takedown",
    type: "Event Setup & Takedown",
    location: "Walnut Creek, CA",
    requirements: [],
    tags: ["Paid backup"],
    shifts: ["Sat 9/26, 3:00pm – 8:00pm"],
    pay: { min: 19.61, max: 19.61, unit: "hour" },
    naics: "71",
  },
  {
    partner: "instawork",
    company: "Azazie",
    position: "General Labor",
    type: "General Labor",
    location: "Walnut Creek, CA",
    requirements: [],
    tags: [],
    shifts: ["Sun 9/27, 3:00pm – 5:00pm"],
    pay: { min: 20, max: 20, unit: "hour" },
    naics: "44",
  },
  {
    partner: "instawork",
    company: "Bluestar Refreshment Services",
    position: "General Labor",
    type: "General Labor",
    location: "Fremont, CA",
    requirements: [],
    tags: ["Multi-day"],
    shifts: ["Fri 10/2, 2:00am – 10:30am"],
    pay: { min: 18.78, max: 18.78, unit: "hour" },
    naics: "72",
  },
  {
    partner: "instawork",
    company: "DesiCrew Solutions",
    position: "General Labor",
    type: "General Labor",
    location: "San Jose, CA",
    requirements: [],
    tags: [],
    shifts: [
      "Mon 9/28 + Fri 10/2, 9:00am – 10:30am",
      "Mon 9/28 + Fri 10/2, 1:00pm – 2:30pm",
      "Mon 9/28 + Fri 10/2, 2:30pm – 4:00pm",
    ],
    pay: { min: 26.37, max: 26.37, unit: "hour" },
    naics: "56",
  },
  {
    partner: "instawork",
    company: "Jitsu",
    position: "Warehouse Associate – Entry Level",
    type: "Warehouse Associate",
    location: "San Leandro, CA",
    requirements: [],
    tags: ["Long-term", "W-2"],
    shifts: [
      "Sat 9/26, 6:00pm – 12:30am",
      "Sat 9/26, 8:15pm – 4:30am",
      "Sun 9/27, 5:30pm – 2:30am",
    ],
    pay: { min: 18, max: 18, unit: "hour" },
    naics: "48",
  },
  {
    partner: "instawork",
    company: "Legends at Shoreline Amphitheatre",
    position: "Alcohol Compliance Monitor",
    type: "Alcohol Compliance Monitor",
    location: "Mountain View, CA",
    requirements: [],
    tags: ["Needs approval", "Tips"],
    shifts: ["Sat 9/26, 4:00pm – 10:00pm"],
    pay: { min: 19.7, max: 19.7, unit: "hour", note: "$19.70/hr plus tips" },
    naics: "72",
  },
  {
    partner: "instawork",
    company: "Levi's Stadium",
    position: "Concession / Stand Worker",
    type: "Concession Worker",
    location: "Santa Clara, CA",
    requirements: [],
    tags: [],
    shifts: ["Sun 9/27, 8:00am – 6:00pm"],
    pay: { min: 19, max: 19, unit: "hour" },
    naics: "72",
  },
  {
    partner: "instawork",
    company: "Off the Grid SF",
    position: "Event Setup and Takedown",
    type: "Event Setup & Takedown",
    location: "Pleasant Hill, CA",
    requirements: [],
    tags: [],
    shifts: ["3:00pm – 5:00pm"],
    pay: { min: 19.65, max: 19.65, unit: "hour" },
    naics: "71",
  },
  {
    partner: "instawork",
    company: "Aramark (Oracle Park)",
    position: "Concession / Stand Worker",
    type: "Concession Worker",
    location: "San Francisco, CA",
    requirements: [],
    tags: [],
    shifts: ["Sun 9/27, 9:45am – 2:45pm"],
    pay: { min: 21.48, max: 21.48, unit: "hour" },
    naics: "72",
  },
  {
    partner: "instawork",
    company: "Palisades Hospitality",
    position: "General Labor",
    type: "General Labor",
    location: "Olema, CA",
    requirements: [],
    tags: ["Top Pro bonus"],
    shifts: ["Tue 9/29, 10:00am – 3:00pm"],
    pay: { min: 23.63, max: 23.63, unit: "hour", note: "$23.63/hr (was $25.99)" },
    naics: "72",
  },
  {
    partner: "instawork",
    company: "Picnic",
    position: "Driver",
    type: "Driver",
    location: "San Francisco, CA",
    requirements: [],
    tags: ["Long-term"],
    shifts: ["10:00am – 12:00pm", "10:00am – 12:30pm", "10:30am – 12:00pm"],
    pay: { min: 29.66, max: 35.77, unit: "hour" },
    naics: "48",
  },
  {
    partner: "instawork",
    company: "Priority Shift Applications",
    position: "Driver",
    type: "Driver",
    location: "San Jose, CA",
    requirements: [],
    tags: ["Multi-day", "Trial shift"],
    shifts: ["Mon 9/28 + Wed 9/30, 8:00am – 5:00pm"],
    pay: { min: 25, max: 25, unit: "hour" },
    naics: "48",
  },
  {
    partner: "instawork",
    company: "Priority Shift Applications",
    position: "Home Recording Host",
    type: "Home Recording Host",
    location: "Dallas, TX",
    requirements: [],
    tags: [],
    shifts: ["Sun 9/27, Mon 9/28, Wed 9/30, 10:00am – 1:00pm"],
    pay: { min: 20, max: 20, unit: "hour" },
    naics: "56",
  },
  {
    partner: "instawork",
    company: "tacit",
    position: "General Labor",
    type: "General Labor",
    location: "San Francisco, CA",
    requirements: [],
    tags: [],
    shifts: [
      "Sun 9/27 – Wed 9/30, 15 four-hour shifts from 6:45am to 9:15pm (e.g. 6:45am – 10:45am, 12:00pm – 4:00pm, 5:15pm – 9:15pm)",
    ],
    pay: { min: 19.61, max: 19.61, unit: "hour" },
    naics: "56",
  },
  {
    partner: "instawork",
    company: "tacit",
    position: "Data Collector",
    type: "Data Collector",
    location: "San Jose, CA",
    requirements: [],
    tags: [],
    shifts: [
      "Mon 9/28 – Wed 9/30 + Fri 10/2, 7:00am – 10:30am",
      "10:45am – 2:15pm",
      "2:30pm – 6:00pm",
      "6:15pm – 9:45pm",
    ],
    pay: { min: 20, max: 20, unit: "hour" },
    naics: "54",
  },
  {
    partner: "instawork",
    company: "UX Study Santa Clara",
    position: "Paid Research Participant",
    type: "Research Participant",
    location: "Santa Clara, CA",
    requirements: [],
    tags: [],
    shifts: [
      "Mon 9/28, Wed 9/30, Fri 10/2, 8:30am – 11:30am",
      "11:30am – 2:30pm",
      "2:30pm – 5:30pm",
      "5:30pm – 8:30pm",
    ],
    pay: { min: 33.33, max: 33.33, unit: "hour" },
    naics: "54",
  },
];
