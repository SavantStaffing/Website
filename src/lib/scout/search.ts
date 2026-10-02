import { METROS, STATES } from "./location.ts";

/**
 * Search boxes that treat equivalent terms alike: "CA" finds "California"
 * and "California" finds "CA"; "RN" finds "Registered Nurse"; "NYC" finds
 * "New York". Plain text still matches anywhere, as before.
 */

const CODE_BY_NAME = new Map(Object.entries(STATES).map(([code, name]) => [name, code]));

/** Place names with the same meaning. Lower-case; matched as whole words. */
const PLACE_ALIASES: string[][] = [
  ["nyc", "new york city", "new york, ny", "manhattan"],
  ["sf", "san francisco"],
  ["la", "los angeles"],
  ["dc", "washington, dc", "washington dc", "district of columbia"],
  ["socal", "southern california"],
  ["norcal", "northern california"],
  ["philly", "philadelphia"],
  ["vegas", "las vegas"],
  ["nola", "new orleans"],
  ["st louis", "saint louis"],
  ["st paul", "saint paul"],
  ["st petersburg", "saint petersburg"],
  ["ft lauderdale", "fort lauderdale"],
  ["ft worth", "fort worth"],
  ["usa", "us", "united states", "united states of america"],
];

const REMOTE = new Set(["remote", "wfh", "work from home", "anywhere", "virtual"]);

/** Job-title shorthand with the same meaning. Lower-case; matched as whole words. */
const TITLE_ALIASES: string[][] = [
  ["rn", "registered nurse"],
  ["lpn", "licensed practical nurse"],
  ["lvn", "licensed vocational nurse"],
  ["cna", "certified nursing assistant", "nursing assistant"],
  ["np", "nurse practitioner"],
  ["pa", "physician assistant"],
  ["ma", "medical assistant"],
  ["sr", "senior"],
  ["jr", "junior"],
  ["mgr", "manager"],
  ["asst", "assistant"],
  ["assoc", "associate"],
  ["admin", "administrative", "administrator"],
  ["exec", "executive"],
  ["eng", "engineer", "engineering"],
  ["swe", "software engineer"],
  ["dev", "developer"],
  ["hr", "human resources"],
  ["qa", "quality assurance"],
  ["it", "information technology"],
  ["csr", "customer service representative", "customer service rep"],
  ["rep", "representative"],
  ["acct", "accountant", "accounting"],
  ["cpa", "certified public accountant"],
  ["ops", "operations"],
  ["vp", "vice president"],
  ["pm", "project manager", "product manager"],
  ["ux", "user experience"],
  ["ui", "user interface"],
  ["ml", "machine learning"],
  ["ai", "artificial intelligence"],
  ["cdl", "commercial driver"],
  ["hvac", "heating ventilation air conditioning"],
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word match, so "ca" doesn't hit "Chicago" and "ai" doesn't hit "maintenance". */
const hasWord = (text: string, word: string) =>
  new RegExp(`(^|[^a-z0-9])${escape(word)}([^a-z0-9]|$)`).test(text);

/** Every way of writing `query`: the alias group it equals, plus itself. */
function variantsOf(query: string, groups: string[][]): string[] {
  const group = groups.find((g) => g.includes(query));
  return group ? group : [query];
}

/**
 * Does a location match what was typed in a location box? Handles state
 * codes and names both ways, city and region shorthand, and "remote".
 */
export function locationMatches(
  location: string | null | undefined,
  query: string,
  remote = false,
): boolean {
  const q = norm(query);
  if (!q) return true;
  const where = norm(location ?? "");

  if (REMOTE.has(q)) return remote || /\b(remote|work from home|anywhere|virtual)\b/.test(where);

  // A state, typed as its code ("CA") or its name ("California").
  const code = q.length === 2 && STATES[q.toUpperCase()] ? q.toUpperCase() : CODE_BY_NAME.get(q);
  if (code) {
    const name = STATES[code];
    // "LA" and "DC" are also places; keep those meanings too.
    const extra = variantsOf(q, PLACE_ALIASES).filter((v) => v !== q);
    return (
      hasWord(where, code.toLowerCase()) ||
      where.includes(name) ||
      extra.some((v) => hasWord(where, v))
    );
  }

  // A metro by its full name ("San Diego–Chula Vista–Carlsbad").
  const metro = METROS.find((m) => norm(m.name) === q);
  if (metro) return metro.match.test(location ?? "");
  if (q === "bay area")
    return METROS.some((m) => m.name.startsWith("San Francisco") && m.match.test(location ?? ""));

  const variants = variantsOf(q, PLACE_ALIASES);
  if (variants.length > 1) return variants.some((v) => hasWord(where, v));

  // Partly typed state name ("calif") also finds the code ("CA").
  if (q.length >= 3)
    for (const [c, name] of Object.entries(STATES))
      if (name.startsWith(q) && hasWord(where, c.toLowerCase())) return true;

  return where.includes(q);
}

/**
 * Does `text` contain every word typed in a keyword box? Shorthand and long
 * forms match each other ("sr rn" finds "Senior Registered Nurse"). Words of
 * three letters or fewer must start a word, so "it" doesn't hit "kitchen".
 */
export function textMatches(text: string, query: string): boolean {
  let q = norm(query);
  if (!q) return true;
  const hay = norm(text);
  const contains = (term: string) =>
    term.length <= 3 ? new RegExp(`(^|[^a-z0-9])${escape(term)}`).test(hay) : hay.includes(term);

  // Whole phrases first ("registered nurse"), then the remaining words one by one.
  const needs: string[][] = [];
  for (const group of TITLE_ALIASES)
    for (const v of group)
      if (v.includes(" ") && hasWord(q, v)) {
        needs.push(group);
        q = q.replace(v, " ");
        break;
      }
  // A word is also kept as typed, so "pa" still finds "Packer" while you type.
  for (const word of q.split(" ").filter(Boolean))
    needs.push([...new Set([word, ...variantsOf(word, TITLE_ALIASES)])]);

  return needs.every((alts) => alts.some(contains));
}
