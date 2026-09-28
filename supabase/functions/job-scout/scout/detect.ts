// Generated from src/lib/scout/detect.ts by scripts/build-scout-function.mjs. Do not edit.
import type { AtsPlatform } from "./types.ts";

/**
 * "Identify ATS platform". Works on a single URL (a job link, a careers page
 * URL) or on a whole HTML document from the company web scan — careers pages
 * almost always embed or link to their ATS board.
 *
 * Order matters: API/embed patterns are the most specific, so they go first.
 */
const PATTERNS: { ats: AtsPlatform; rx: RegExp; token?: (m: RegExpMatchArray) => string }[] = [
  // Workday: token = "{host}/{tenant}/{site}" (see workday.ts)
  {
    ats: "workday",
    rx: /([\w-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:wday\/cxs\/[\w-]+\/)?(?:[a-z]{2}-[A-Z]{2}\/)?([\w-]+)/i,
    token: (m) => `${m[1]}.${m[2]}.myworkdayjobs.com/${m[1]}/${m[3]}`,
  },
  {
    ats: "workday",
    rx: /(wd\d+)\.myworkdaysite\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?recruiting\/([\w-]+)\/([\w-]+)/i,
    token: (m) => `${m[1]}.myworkdaysite.com/${m[2]}/${m[3]}`,
  },
  // Staffing-agency boards (staffing-boards.ts). Avionte token = "{buildIdEnc}/{jobBoardIdEnc}".
  {
    ats: "avionte",
    rx: /hire\.myavionte\.com\/app\/careers\/#\/jobs\/([\w-]+)\/([\w-]+)/i,
    token: (m) => `${m[1]}/${m[2]}`,
  },
  { ats: "smpl", rx: /(https?:\/\/[\w.-]+)\/(?:json\/)?index\.smpl\?arg=(?:jb_|list_posts)/i },
  { ats: "partners", rx: /(https?:\/\/jobs\.partnerspersonnel\.com)/i },
  // iCIMS: token = portal subdomain
  { ats: "icims", rx: /\b((?!www\b)[\w-]+)\.icims\.com/i },
  { ats: "greenhouse", rx: /boards-api\.greenhouse\.io\/v1\/boards\/([\w-]+)/i },
  { ats: "greenhouse", rx: /greenhouse\.io\/embed\/job_board(?:\/js)?\?for=([\w-]+)/i },
  { ats: "greenhouse", rx: /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?!embed\b)([\w-]+)/i },
  { ats: "lever", rx: /api\.lever\.co\/v0\/postings\/([\w.-]+)/i },
  { ats: "lever", rx: /jobs\.lever\.co\/([\w.-]+)/i },
  { ats: "ashby", rx: /api\.ashbyhq\.com\/posting-api\/job-board\/([\w.%-]+)/i },
  { ats: "ashby", rx: /jobs\.ashbyhq\.com\/([\w.%-]+)/i },
  { ats: "smartrecruiters", rx: /api\.smartrecruiters\.com\/v1\/companies\/([\w-]+)/i },
  { ats: "smartrecruiters", rx: /(?:careers|jobs)\.smartrecruiters\.com\/([\w-]+)/i },
  { ats: "workable", rx: /apply\.workable\.com\/(?:api\/v\d\/widget\/accounts\/)?([\w-]+)/i },
  { ats: "workable", rx: /\b([\w-]+)\.workable\.com/i },
];

// Path segments that look like a token but aren't one.
const NOT_TOKENS = new Set([
  "embed",
  "api",
  "v1",
  "j",
  "jobs",
  "careers",
  "www",
  "apply",
  "static",
  "wday",
  "recruiting",
]);

export type AtsHit = { ats: AtsPlatform; token: string };

function hitFrom(
  ats: AtsPlatform,
  m: RegExpMatchArray,
  token?: (m: RegExpMatchArray) => string,
): AtsHit | null {
  if (!m[1] || NOT_TOKENS.has(m[1].toLowerCase())) return null;
  if (m[3] && NOT_TOKENS.has(m[3].toLowerCase())) return null;
  return { ats, token: token ? token(m) : decodeURIComponent(m[1]) };
}

export function detectAts(text: string): AtsHit | null {
  for (const { ats, rx, token } of PATTERNS) {
    const m = rx.exec(text);
    const hit = m && hitFrom(ats, m, token);
    if (hit) return hit;
  }
  return null;
}

/** All distinct ATS boards referenced in a page — a careers page can list more than one. */
export function detectAllAts(html: string): AtsHit[] {
  const seen = new Map<string, AtsHit>();
  for (const { ats, rx, token } of PATTERNS) {
    const global = new RegExp(rx.source, "gi");
    for (const m of html.matchAll(global)) {
      const hit = hitFrom(ats, m, token);
      if (hit) seen.set(`${ats}:${hit.token.toLowerCase()}`, hit);
    }
  }
  return [...seen.values()];
}

/**
 * Job-board platforms we can recognize but have no scanner for yet. Their
 * job lists are built in the browser or sit behind per-client APIs, so a
 * site using one goes into the unique-scanner registry
 * (unique_scanner_sites) with the platform named.
 */
const UNSUPPORTED: { platform: string; rx: RegExp }[] = [
  { platform: "Paycom", rx: /paycomonline\.(?:net|com)\/v4\/ats/i },
  { platform: "Avionte", rx: /\b(?:[\w-]+\.)?(?:myavionte|aviontego)\.com/i },
  {
    platform: "Bullhorn",
    rx: /\bbullhorn(?:staffing|reach|jobs)?\.com|\bbhsearch|cxs\.bullhornstaffing/i,
  },
  { platform: "JobDiva", rx: /\bjobdiva\.com/i },
  { platform: "Ceipal", rx: /\bceipal\.com/i },
  { platform: "TempWorks", rx: /\btempworks\.com|\bhirecentric|\bbeyond\.tempworks/i },
  { platform: "UKG / UltiPro", rx: /\bultipro\.com|\brecruiting\.ultipro|\bukg\.net/i },
  { platform: "ADP", rx: /\bworkforcenow\.adp\.com|\brecruiting\.adp\.com|myjobs\.adp\.com/i },
  { platform: "Paylocity", rx: /\brecruiting\.paylocity\.com/i },
  { platform: "Taleo", rx: /\btaleo\.net/i },
  { platform: "SAP SuccessFactors", rx: /\bsuccessfactors\.(?:com|eu)|\bjobs\.sap\.com/i },
  { platform: "Jobvite", rx: /\bjobs\.jobvite\.com/i },
  { platform: "JazzHR", rx: /\bapplytojob\.com|\bjazzhr\.com/i },
  { platform: "Breezy HR", rx: /\b[\w-]+\.breezy\.hr/i },
  { platform: "Dayforce", rx: /\bdayforcehcm\.com/i },
  { platform: "PCRecruiter", rx: /\bpcrecruiter\.net/i },
  { platform: "Crelate", rx: /\bcrelate\.com/i },
  { platform: "Phenom", rx: /\bphenompeople\.com|\bphApp\.ddo/i },
  { platform: "Smpl job board", rx: /\bindex\.smpl\?arg=jb_/i },
];

/** An unsupported job-board platform referenced in a page, if any. */
export function detectUnsupportedPlatform(text: string): string | null {
  return UNSUPPORTED.find((u) => u.rx.test(text))?.platform ?? null;
}

/** The public URL a person would visit for a board — shown in the admin config table. */
export function boardUrl(ats: AtsPlatform, token: string): string {
  switch (ats) {
    case "greenhouse":
      return `https://job-boards.greenhouse.io/${token}`;
    case "lever":
      return `https://jobs.lever.co/${token}`;
    case "ashby":
      return `https://jobs.ashbyhq.com/${token}`;
    case "smartrecruiters":
      return `https://careers.smartrecruiters.com/${token}`;
    case "workable":
      return `https://apply.workable.com/${token}`;
    case "workday": {
      const [host, , site] = token.split("/");
      return `https://${host}/${site}`;
    }
    case "icims":
      return `https://${token}.icims.com/jobs/search`;
    case "jsonld":
      return token;
    case "avionte": {
      const [b, jb] = token.split("/");
      return `https://hire.myavionte.com/app/careers/#/jobs/${b}/${jb}//`;
    }
    case "smpl":
      return `${token}/index.smpl?arg=jb_search_results`;
    case "partners":
      return token;
  }
}
