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
  }
}
