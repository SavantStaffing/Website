/**
 * Regions on the Insights page. EDD's datasets (LAUS, OEWS, CES,
 * projections) share metro names, except projections append the counties
 * in brackets and LAUS/CES mark San Rafael "MD**" — `edd` is the shared
 * base name and the server matches the variants.
 */

export type Region = {
  slug: string;
  label: string;
  /** Counties covered, shown under the name. */
  counties: string;
  /** EDD area name (LAUS, OEWS, CES). */
  edd: string;
  areaType: "State" | "Metropolitan Area";
  group: "Statewide" | "Bay Area" | "Southern California" | "Central & Northern California";
};

const metro = (
  slug: string,
  label: string,
  counties: string,
  edd: string,
  group: Region["group"],
): Region => ({ slug, label, counties, edd, areaType: "Metropolitan Area", group });

export const REGIONS: Region[] = [
  {
    slug: "california",
    label: "California",
    counties: "Statewide",
    edd: "California",
    areaType: "State",
    group: "Statewide",
  },
  // Bay Area
  metro(
    "san-francisco",
    "San Francisco & San Mateo",
    "San Francisco and San Mateo Counties",
    "San Francisco-San Mateo-Redwood City MD",
    "Bay Area",
  ),
  metro(
    "oakland",
    "Oakland & East Bay",
    "Alameda and Contra Costa Counties",
    "Oakland-Fremont-Berkeley MD",
    "Bay Area",
  ),
  metro(
    "san-jose",
    "San Jose & Silicon Valley",
    "Santa Clara and San Benito Counties",
    "San Jose-Sunnyvale-Santa Clara MSA",
    "Bay Area",
  ),
  metro("marin", "Marin", "Marin County", "San Rafael MD", "Bay Area"),
  metro(
    "santa-rosa",
    "Santa Rosa & Sonoma",
    "Sonoma County",
    "Santa Rosa-Petaluma MSA",
    "Bay Area",
  ),
  metro("napa", "Napa", "Napa County", "Napa MSA", "Bay Area"),
  metro("vallejo", "Vallejo & Solano", "Solano County", "Vallejo MSA", "Bay Area"),
  metro("santa-cruz", "Santa Cruz", "Santa Cruz County", "Santa Cruz-Watsonville MSA", "Bay Area"),
  // Southern California
  metro(
    "los-angeles",
    "Los Angeles",
    "Los Angeles County",
    "Los Angeles-Long Beach-Glendale MD",
    "Southern California",
  ),
  metro(
    "orange-county",
    "Orange County",
    "Orange County",
    "Anaheim-Santa Ana-Irvine MD",
    "Southern California",
  ),
  metro(
    "san-diego",
    "San Diego",
    "San Diego County",
    "San Diego-Chula Vista-Carlsbad MSA",
    "Southern California",
  ),
  metro(
    "inland-empire",
    "Inland Empire",
    "Riverside and San Bernardino Counties",
    "Riverside-San Bernardino-Ontario MSA",
    "Southern California",
  ),
  metro(
    "ventura",
    "Ventura",
    "Ventura County",
    "Oxnard-Thousand Oaks-Ventura MSA",
    "Southern California",
  ),
  metro(
    "santa-barbara",
    "Santa Barbara",
    "Santa Barbara County",
    "Santa Maria-Santa Barbara MSA",
    "Southern California",
  ),
  // Central & Northern California
  metro(
    "sacramento",
    "Sacramento",
    "Sacramento, Placer, El Dorado and Yolo Counties",
    "Sacramento-Roseville-Folsom MSA",
    "Central & Northern California",
  ),
  metro(
    "fresno",
    "Fresno",
    "Fresno and Madera Counties",
    "Fresno MSA",
    "Central & Northern California",
  ),
  metro(
    "stockton",
    "Stockton",
    "San Joaquin County",
    "Stockton-Lodi MSA",
    "Central & Northern California",
  ),
  metro("modesto", "Modesto", "Stanislaus County", "Modesto MSA", "Central & Northern California"),
  metro(
    "bakersfield",
    "Bakersfield",
    "Kern County",
    "Bakersfield-Delano MSA",
    "Central & Northern California",
  ),
  metro(
    "salinas",
    "Salinas & Monterey",
    "Monterey County",
    "Salinas MSA",
    "Central & Northern California",
  ),
];

export const DEFAULT_REGION = "san-francisco";

export const regionBySlug = (slug: string | undefined): Region =>
  REGIONS.find((r) => r.slug === slug) ?? REGIONS.find((r) => r.slug === DEFAULT_REGION)!;

/**
 * Occupations shown in the pay table: common Savant placements on both
 * feeds, by OEWS SOC code (no dash). Any other occupation can be searched.
 */
export const FEATURED_OCCUPATIONS: { soc: string; track: "hourly" | "professional" }[] = [
  { soc: "537062", track: "hourly" }, // Laborers and freight, stock & material movers
  { soc: "537065", track: "hourly" }, // Stockers and order fillers
  { soc: "533033", track: "hourly" }, // Light truck drivers
  { soc: "352014", track: "hourly" }, // Cooks, restaurant
  { soc: "353031", track: "hourly" }, // Waiters and waitresses
  { soc: "353023", track: "hourly" }, // Fast food and counter workers
  { soc: "339032", track: "hourly" }, // Security guards
  { soc: "372011", track: "hourly" }, // Janitors and cleaners
  { soc: "412031", track: "hourly" }, // Retail salespersons
  { soc: "434051", track: "hourly" }, // Customer service representatives
  { soc: "311131", track: "hourly" }, // Nursing assistants
  { soc: "151252", track: "professional" }, // Software developers
  { soc: "291141", track: "professional" }, // Registered nurses
  { soc: "132011", track: "professional" }, // Accountants and auditors
  { soc: "111021", track: "professional" }, // General and operations managers
  { soc: "131082", track: "professional" }, // Project management specialists
  { soc: "131071", track: "professional" }, // Human resources specialists
  { soc: "132051", track: "professional" }, // Financial and investment analysts
  { soc: "131161", track: "professional" }, // Market research analysts & marketing
  { soc: "151211", track: "professional" }, // Computer systems analysts
  { soc: "172071", track: "professional" }, // Electrical engineers
  { soc: "119111", track: "professional" }, // Medical and health services managers
  { soc: "472111", track: "professional" }, // Electricians
];

/** CES supersectors shown in the industry trends, by series code. */
export const INDUSTRY_SERIES: { code: string; label: string }[] = [
  { code: "20000000", label: "Construction" },
  { code: "30000000", label: "Manufacturing" },
  { code: "40000000", label: "Trade, transportation & utilities" },
  { code: "50000000", label: "Information" },
  { code: "55000000", label: "Financial activities" },
  { code: "60000000", label: "Professional & business services" },
  { code: "65000000", label: "Education & health services" },
  { code: "70000000", label: "Leisure & hospitality" },
  { code: "80000000", label: "Other services" },
  { code: "90000000", label: "Government" },
];
