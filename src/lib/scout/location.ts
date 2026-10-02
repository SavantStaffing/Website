/**
 * Is a posting in the United States? The Job Scout only ingests U.S. jobs.
 *
 * Sources write locations every which way — "US, CA, Santa Clara",
 * "Boise, ID - Main Site", "Seattle-WA-2nd Ave", "Remote-USA",
 * "Fort Collins, Colorado, United States of America", "Pune, India",
 * "Israel, Yokneam", "Mexico City". The checks run strongest first:
 *
 *   1. an explicit U.S. country marker          → "us"
 *   2. a foreign country or a foreign-only city → "foreign"
 *   3. a U.S. state (name or code) or major city → "us"
 *   4. nothing to go on ("Remote", blank)       → "unknown"
 *
 * Step 2 runs before step 3 so "Toronto, ON, CA" and "Baja California, Mexico"
 * aren't mistaken for California, while "Ontario, CA" (a California city)
 * still counts as U.S. Only "us" is ingested.
 */

export type LocationVerdict = "us" | "foreign" | "unknown";

const US_COUNTRY = /\b(united states( of america)?|usa)\b/i;
// Upper-case only, so the word "us" in prose doesn't count.
const US_TOKEN = /(^|[^A-Za-z])US([^A-Za-z]|$)/;

export const STATES: Record<string, string> = {
  AL: "alabama",
  AK: "alaska",
  AZ: "arizona",
  AR: "arkansas",
  CA: "california",
  CO: "colorado",
  CT: "connecticut",
  DE: "delaware",
  FL: "florida",
  GA: "georgia",
  HI: "hawaii",
  ID: "idaho",
  IL: "illinois",
  IN: "indiana",
  IA: "iowa",
  KS: "kansas",
  KY: "kentucky",
  LA: "louisiana",
  ME: "maine",
  MD: "maryland",
  MA: "massachusetts",
  MI: "michigan",
  MN: "minnesota",
  MS: "mississippi",
  MO: "missouri",
  MT: "montana",
  NE: "nebraska",
  NV: "nevada",
  NH: "new hampshire",
  NJ: "new jersey",
  NM: "new mexico",
  NY: "new york",
  NC: "north carolina",
  ND: "north dakota",
  OH: "ohio",
  OK: "oklahoma",
  OR: "oregon",
  PA: "pennsylvania",
  RI: "rhode island",
  SC: "south carolina",
  SD: "south dakota",
  TN: "tennessee",
  TX: "texas",
  UT: "utah",
  VT: "vermont",
  VA: "virginia",
  WA: "washington",
  WV: "west virginia",
  WI: "wisconsin",
  WY: "wyoming",
  DC: "district of columbia",
  PR: "puerto rico",
};
const STATE_NAME = new RegExp(`\\b(${Object.values(STATES).join("|")})\\b`, "i");

const US_CITIES = [
  "san francisco",
  "south san francisco",
  "oakland",
  "berkeley",
  "san jose",
  "santa clara",
  "sunnyvale",
  "mountain view",
  "palo alto",
  "menlo park",
  "redwood city",
  "fremont",
  "hayward",
  "san mateo",
  "cupertino",
  "milpitas",
  "walnut creek",
  "los angeles",
  "san diego",
  "sacramento",
  "new york",
  "new york city",
  "brooklyn",
  "manhattan",
  "seattle",
  "bellevue",
  "chicago",
  "boston",
  "austin",
  "dallas",
  "houston",
  "san antonio",
  "denver",
  "boulder",
  "atlanta",
  "miami",
  "orlando",
  "tampa",
  "phoenix",
  "portland",
  "salt lake city",
  "las vegas",
  "minneapolis",
  "detroit",
  "nashville",
  "charlotte",
  "raleigh",
  "durham",
  "philadelphia",
  "pittsburgh",
  "baltimore",
  "washington dc",
  "st louis",
  "kansas city",
  "columbus",
  "indianapolis",
  "cincinnati",
  "cleveland",
  "milwaukee",
  "honolulu",
];
const US_CITY = new RegExp(`\\b(${US_CITIES.join("|")})\\b`, "i");

const FOREIGN_COUNTRIES = [
  "canada",
  "mexico",
  "brazil",
  "argentina",
  "chile",
  "colombia",
  "peru",
  "costa rica",
  "guatemala",
  "panama",
  "uruguay",
  "ecuador",
  "venezuela",
  "dominican republic",
  "united kingdom",
  "uk",
  "england",
  "scotland",
  "wales",
  "northern ireland",
  "ireland",
  "france",
  "germany",
  "spain",
  "portugal",
  "italy",
  "netherlands",
  "belgium",
  "switzerland",
  "austria",
  "sweden",
  "norway",
  "denmark",
  "finland",
  "poland",
  "czech republic",
  "czechia",
  "hungary",
  "romania",
  "bulgaria",
  "greece",
  "turkey",
  "türkiye",
  "ukraine",
  "serbia",
  "croatia",
  "slovakia",
  "slovenia",
  "lithuania",
  "latvia",
  "estonia",
  "luxembourg",
  "iceland",
  "israel",
  "egypt",
  "south africa",
  "nigeria",
  "kenya",
  "morocco",
  "ghana",
  "saudi arabia",
  "united arab emirates",
  "uae",
  "qatar",
  "kuwait",
  "bahrain",
  "oman",
  "jordan",
  "india",
  "pakistan",
  "bangladesh",
  "sri lanka",
  "nepal",
  "china",
  "prc",
  "hong kong",
  "taiwan",
  "japan",
  "south korea",
  "korea",
  "singapore",
  "malaysia",
  "indonesia",
  "thailand",
  "vietnam",
  "viet nam",
  "philippines",
  "australia",
  "new zealand",
];
const FOREIGN_CITIES = [
  "bengaluru",
  "bangalore",
  "pune",
  "hyderabad",
  "chennai",
  "mumbai",
  "navi mumbai",
  "gurgaon",
  "gurugram",
  "noida",
  "new delhi",
  "kolkata",
  "ahmedabad",
  "mexico city",
  "ciudad de mexico",
  "guadalajara",
  "monterrey",
  "tlaquepaque",
  "sao paulo",
  "rio de janeiro",
  "buenos aires",
  "bogota",
  "toronto",
  "montreal",
  "markham",
  "mississauga",
  "calgary",
  "ottawa",
  "tbilisi",
  "shanghai",
  "beijing",
  "shenzhen",
  "guangzhou",
  "tokyo",
  "osaka",
  "hiroshima",
  "seoul",
  "taipei",
  "hsinchu",
  "taichung",
  "tainan",
  "taoyuan",
  "tel aviv",
  "yokneam",
  "haifa",
  "herzliya",
  "raanana",
  "cairo",
  "dubai",
  "abu dhabi",
  "riyadh",
  "lisbon",
  "porto",
  "madrid",
  "barcelona",
  "munich",
  "frankfurt",
  "amsterdam",
  "warsaw",
  "krakow",
  "prague",
  "budapest",
  "bucharest",
  "kuala lumpur",
  "penang",
  "batu kawan",
  "hanoi",
  "ho chi minh",
  "jakarta",
  "manila",
  "bangkok",
  "sydney",
  "melbourne",
  "st leonards",
  "auckland",
];
const FOREIGN = new RegExp(`\\b(${[...FOREIGN_COUNTRIES, ...FOREIGN_CITIES].join("|")})\\b`, "i");

/** Accents and dots dropped ("São Paulo" → "Sao Paulo", "U.S." → "US"); case kept for US_TOKEN. */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\./g, "");

/** A two-letter state code standing alone between separators: ", CA", "-WA-", "ID - Main Site", "CA 95054". */
function hasStateCode(s: string): boolean {
  const parts = s.split(/[,;|/()\-–—]+/).map((p) => p.trim().replace(/\s+\d{5}(-\d{4})?$/, ""));
  return parts.some((p) => p in STATES);
}

export function classifyLocation(location: string | null | undefined): LocationVerdict {
  const raw = (location ?? "").trim();
  if (!raw) return "unknown";
  const s = fold(raw);

  if (US_COUNTRY.test(s) || US_TOKEN.test(s)) return "us";
  // "New Mexico" is a state, not Mexico.
  if (FOREIGN.test(s.replace(/new mexico/gi, ""))) return "foreign";
  if (hasStateCode(s) || STATE_NAME.test(s) || US_CITY.test(s)) return "us";
  return "unknown";
}

export const isUnitedStates = (location: string | null | undefined) =>
  classifyLocation(location) === "us";

/**
 * Metro areas the Job Scout targets. Active metros are where the job-search
 * APIs look (searching within about 50 miles of each anchor city) and which
 * postings win when an employer's postings are capped. Dormant metros are
 * listed so they can be switched on later by flipping `active`.
 */
export type Metro = {
  name: string;
  /** Search locations, each covering about 50 miles around it. */
  anchors: string[];
  /** Cities and counties in the metro, to recognise a posting's location. */
  match: RegExp;
  active: boolean;
};

export const METROS: Metro[] = [
  {
    name: "New York–Newark–Jersey City",
    anchors: ["New York, NY"],
    match:
      /\b(new york|nyc|manhattan|brooklyn|queens|bronx|staten island|newark|jersey city|hoboken|yonkers|white plains|stamford|long island)\b/i,
    active: true,
  },
  {
    name: "Portland–Eugene",
    anchors: ["Portland, OR", "Eugene, OR"],
    match:
      /\b(portland(?!,? *(me|maine)\b)|beaverton|hillsboro|gresham|tigard|lake oswego|tualatin|wilsonville|salem|corvallis|albany|eugene|springfield, or|vancouver, wa)\b/i,
    active: true,
  },
  {
    name: "Los Angeles–Long Beach–Anaheim",
    anchors: ["Los Angeles, CA"],
    match:
      /\b(los angeles|long beach|anaheim|santa monica|pasadena|glendale|burbank|torrance|irvine|santa ana|costa mesa|culver city|el segundo|orange county)\b/i,
    active: true,
  },
  {
    name: "San Francisco–Oakland–Berkeley",
    anchors: ["San Francisco, CA"],
    match:
      /\b(san francisco|south san francisco|oakland|berkeley|emeryville|alameda|richmond|san leandro|hayward|fremont|newark, ca|union city|san jose|santa clara|sunnyvale|mountain view|palo alto|menlo park|redwood city|san mateo|burlingame|foster city|san carlos|belmont|brisbane|daly city|san bruno|milpitas|cupertino|campbell|los gatos|walnut creek|concord|pleasanton|livermore|dublin|san ramon|danville|pleasant hill|novato|san rafael|marin|contra costa|bay area)\b/i,
    active: true,
  },
  {
    name: "Riverside–San Bernardino–Ontario",
    anchors: ["Riverside, CA"],
    match:
      /\b(riverside|san bernardino|ontario, ca|rancho cucamonga|fontana|corona|moreno valley|temecula|murrieta|redlands|inland empire)\b/i,
    active: true,
  },
  {
    name: "San Diego–Chula Vista–Carlsbad",
    anchors: ["San Diego, CA"],
    match: /\b(san diego|chula vista|carlsbad|oceanside|escondido|la jolla|el cajon|san marcos)\b/i,
    active: true,
  },
  {
    name: "Chicago–Naperville–Elgin",
    anchors: ["Chicago, IL"],
    match: /\b(chicago|naperville|elgin|evanston|schaumburg|aurora, il)\b/i,
    active: false,
  },
  {
    name: "Dallas–Fort Worth–Arlington",
    anchors: ["Dallas, TX"],
    match: /\b(dallas|fort worth|arlington, tx|plano|irving|frisco)\b/i,
    active: false,
  },
  {
    name: "Houston–Pasadena–The Woodlands",
    anchors: ["Houston, TX"],
    match: /\b(houston|pasadena, tx|the woodlands|sugar land|katy)\b/i,
    active: false,
  },
  {
    name: "Washington–Arlington–Alexandria",
    anchors: ["Washington, DC"],
    match:
      /\b(washington,? dc|district of columbia|arlington, va|alexandria|bethesda|reston|tysons)\b/i,
    active: false,
  },
  {
    name: "Miami–Fort Lauderdale–West Palm Beach",
    anchors: ["Fort Lauderdale, FL"],
    match: /\b(miami|fort lauderdale|west palm beach|boca raton|hollywood, fl)\b/i,
    active: false,
  },
  {
    name: "Philadelphia–Camden–Wilmington",
    anchors: ["Philadelphia, PA"],
    match: /\b(philadelphia|camden|wilmington, de|king of prussia)\b/i,
    active: false,
  },
  {
    name: "Atlanta–Sandy Springs–Roswell",
    anchors: ["Atlanta, GA"],
    match: /\b(atlanta|sandy springs|roswell|alpharetta|marietta)\b/i,
    active: false,
  },
  {
    name: "Boston–Cambridge–Newton",
    anchors: ["Boston, MA"],
    match: /\b(boston|cambridge, ma|newton|waltham|somerville)\b/i,
    active: false,
  },
  {
    name: "Phoenix–Mesa–Chandler",
    anchors: ["Phoenix, AZ"],
    match: /\b(phoenix|mesa|chandler|scottsdale|tempe|gilbert)\b/i,
    active: false,
  },
  {
    name: "Detroit–Warren–Dearborn",
    anchors: ["Detroit, MI"],
    match: /\b(detroit|warren|dearborn|troy, mi|southfield)\b/i,
    active: false,
  },
  {
    name: "Seattle–Tacoma–Bellevue",
    anchors: ["Seattle, WA"],
    match: /\b(seattle|tacoma|bellevue|redmond|kirkland|everett)\b/i,
    active: false,
  },
  {
    name: "Minneapolis–St. Paul–Bloomington",
    anchors: ["Minneapolis, MN"],
    match: /\b(minneapolis|st paul|saint paul|bloomington, mn|eden prairie)\b/i,
    active: false,
  },
  {
    name: "Tampa–St. Petersburg–Clearwater",
    anchors: ["Tampa, FL"],
    match: /\b(tampa|st petersburg|saint petersburg|clearwater)\b/i,
    active: false,
  },
  {
    name: "Denver–Aurora–Lakewood",
    anchors: ["Denver, CO"],
    match: /\b(denver|aurora, co|lakewood|boulder|englewood)\b/i,
    active: false,
  },
  {
    name: "Orlando–Kissimmee–Sanford",
    anchors: ["Orlando, FL"],
    match: /\b(orlando|kissimmee|sanford|lake mary)\b/i,
    active: false,
  },
];

export const ACTIVE_METROS = METROS.filter((m) => m.active);

/** Is a posting in one of the active metros? Used to prefer local postings when capping. */
export const inActiveMetro = (location: string | null | undefined) =>
  !!location && ACTIVE_METROS.some((m) => m.match.test(location.replace(/\./g, "")));
