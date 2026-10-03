import { mapLimit, scoutFetch, scoutJson, type MetricsRecorder } from "./http.ts";
import { decodeEntities, htmlToText, iso } from "./text.ts";
import type { RawJob } from "./types.ts";

/**
 * Scanners for enterprise ATS platforms whose job lists are built in the
 * browser. Each replays the public requests the careers page itself makes;
 * no logins, public data only.
 *
 *   successfactors — SAP SuccessFactors Recruiting Marketing ("RMK") sites,
 *                    e.g. careers.thehersheycompany.com. Token = site origin.
 *                    Reads the server-rendered search pages (25 per page).
 *   phenom         — Phenom careers sites. Token = the site's base URL with
 *                    locale, e.g. https://www.qualtrics.com/careers/us/en/.
 *                    Reads the page's own /widgets search API.
 *   dayforce       — Dayforce job boards on jobs.dayforcehcm.com.
 *                    Token = "{clientNamespace}/{jobBoardCode}".
 */

const HTML = { accept: "text/html", timeoutMs: 20_000 } as const;

// ---------------------------------------------------------------- SuccessFactors (RMK)

const SF_PAGE = 25;
const SF_MAX_PAGES = 20;
const SF_MAX_DESCRIPTIONS = 60;

const clean = (s: string | undefined | null) =>
  s ? decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() || null : null;

type SfRow = { id: string; url: string; title: string; location: string | null; date: string | null };

/** Job rows from an RMK search page — handles both the table and the tile layouts. */
export function successFactorsRows(html: string, origin: string): SfRow[] {
  const links = [
    ...html.matchAll(
      /<a\b[^>]*class="[^"]*jobTitle-link[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
    ),
  ];
  const rows = new Map<string, SfRow & { at: number }>();
  for (const m of links) {
    const href = /href="([^"]+)"/i.exec(m[0])?.[1];
    const id = href && /\/(\d{5,})\/?(?:[?#]|$)/.exec(href)?.[1];
    if (!href || !id || rows.has(id)) continue;
    rows.set(id, {
      id,
      url: new URL(decodeEntities(href), origin).toString(),
      title: clean(m[0]) ?? "",
      location: null,
      date: null,
      at: m.index ?? 0,
    });
  }
  const list = [...rows.values()].sort((a, b) => a.at - b.at);
  list.forEach((r, i) => {
    const seg = html.slice(r.at, list[i + 1]?.at ?? r.at + 8000);
    r.location = clean(
      /id="[^"]*-section-location-value"[^>]*>([\s\S]*?)<\/div>/i.exec(seg)?.[1] ??
        /class="jobLocation"[^>]*>([\s\S]*?)<\/span>/i.exec(seg)?.[1],
    );
    r.date = clean(
      /id="[^"]*-section-date-value"[^>]*>([\s\S]*?)<\/div>/i.exec(seg)?.[1] ??
        /class="jobDate"[^>]*>([\s\S]*?)<\/span>/i.exec(seg)?.[1],
    );
  });
  return list.filter((r) => r.title).map(({ at: _at, ...r }) => r);
}

function sfDescription(html: string): string | null {
  const at = html.search(/class="jobdescription"/i);
  if (at < 0) return null;
  let chunk = html.slice(html.indexOf(">", at) + 1, at + 40_000);
  const end = chunk.search(/class="(?:jobFooter|applylink|social-share|job-footer)|<\/article>|<footer/i);
  if (end > 0) chunk = chunk.slice(0, end);
  return htmlToText(chunk);
}

export async function successfactors(
  rec: MetricsRecorder,
  token: string,
  company: string,
): Promise<RawJob[]> {
  const origin = new URL(token).origin;
  const rows = new Map<string, SfRow>();
  let total = Infinity;
  for (let page = 0; page < SF_MAX_PAGES && page * SF_PAGE < total; page++) {
    const res = await scoutFetch(
      rec,
      "successfactors",
      `${origin}/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=${page * SF_PAGE}`,
      HTML,
    );
    const html = await res.text();
    if (page === 0) {
      const t = /of\s*<b>\s*([\d,]+)\s*<\/b>|Showing \d+ to \d+ of ([\d,]+)/i.exec(html);
      if (t) total = Number((t[1] ?? t[2]).replace(/,/g, ""));
    }
    const found = successFactorsRows(html, origin);
    const before = rows.size;
    for (const r of found) rows.set(r.id, r);
    if (rows.size === before) break;
  }

  const list = [...rows.values()];
  const descriptions = new Map<string, string | null>();
  await mapLimit(list.slice(0, SF_MAX_DESCRIPTIONS), 4, async (r) => {
    try {
      const res = await scoutFetch(rec, "successfactors", r.url, HTML);
      descriptions.set(r.id, sfDescription(await res.text()));
    } catch {
      // Listing still usable without its description.
    }
  });

  return list.map((r) => ({
    source: "successfactors",
    external_id: r.id,
    title: r.title,
    company_name: company,
    location: r.location,
    description: descriptions.get(r.id) ?? null,
    apply_url: r.url,
    department: null,
    employment_type_raw: null,
    remote_hint: null,
    posted_at: iso(r.date),
  }));
}

// ---------------------------------------------------------------- Phenom

type PhenomJob = {
  jobId?: string;
  reqId?: string;
  jobSeqNo?: string;
  title?: string;
  location?: string;
  cityStateCountry?: string;
  descriptionTeaser?: string;
  category?: string;
  department?: string;
  type?: string;
  postedDate?: string;
  dateCreated?: string;
  industry?: string;
  applyUrl?: string;
  country?: string;
};

const PHENOM_PAGE = 100;
const PHENOM_MAX = 1000;

/** "https://x.com/careers/us/en/" → widgets URL + locale bits. */
export function phenomEndpoint(token: string) {
  const u = new URL(token);
  const m = /^(.*?)\/([a-z]{2})\/([a-z]{2})\/?$/i.exec(u.pathname);
  const prefix = m ? m[1] : u.pathname.replace(/\/$/, "");
  const country = (m?.[2] ?? "us").toLowerCase();
  const lang = (m?.[3] ?? "en").toLowerCase();
  const base = `${u.origin}${prefix}/${country}/${lang}/`;
  return { widgets: `${u.origin}${prefix}/widgets`, country, lang: `${lang}_${country}`, base };
}

export async function phenom(
  rec: MetricsRecorder,
  token: string,
  company: string,
): Promise<RawJob[]> {
  const ep = phenomEndpoint(token);
  const jobs: PhenomJob[] = [];
  let total = Infinity;
  for (let from = 0; from < Math.min(total, PHENOM_MAX); from += PHENOM_PAGE) {
    const data = await scoutJson<{
      refineSearch?: { totalHits?: number; data?: { jobs?: PhenomJob[] } };
    }>(rec, "phenom", ep.widgets, {
      method: "POST",
      body: JSON.stringify({
        lang: ep.lang,
        deviceType: "desktop",
        country: ep.country,
        pageName: "search-results",
        ddoKey: "refineSearch",
        sortBy: "Most recent",
        from,
        size: PHENOM_PAGE,
        jobs: true,
        counts: false,
        all_fields: [],
        keywords: "",
        global: true,
        selected_fields: {},
        siteType: "external",
      }),
    });
    const page = data.refineSearch?.data?.jobs ?? [];
    total = data.refineSearch?.totalHits ?? page.length;
    jobs.push(...page);
    if (page.length < PHENOM_PAGE) break;
  }
  return jobs
    .filter((j) => j.title && (j.jobId || j.jobSeqNo))
    .map((j) => {
      const id = String(j.jobId ?? j.jobSeqNo);
      return {
        source: "phenom",
        external_id: id,
        title: j.title!,
        company_name: company,
        location: j.location ?? j.cityStateCountry ?? null,
        description: j.descriptionTeaser ?? null,
        apply_url: `${ep.base}job/${encodeURIComponent(id)}`,
        department: j.category ?? j.department ?? null,
        employment_type_raw: j.type ?? null,
        remote_hint: null,
        posted_at: iso(j.postedDate ?? j.dateCreated),
        industry_raw: j.industry ?? null,
      } satisfies RawJob;
    });
}

// ---------------------------------------------------------------- Dayforce

type DayforcePosting = {
  jobPostingId: number;
  jobTitle: string;
  jobDescription?: string | null;
  hasVirtualLocation?: boolean;
  postingStartTimestampUTC?: string | null;
  postingLocations?: { formattedAddress?: string | null; cityName?: string | null; stateCode?: string | null; isoCountryCode?: string | null }[];
};

const DAYFORCE = "https://jobs.dayforcehcm.com";
const DAYFORCE_PAGE = 25;
const DAYFORCE_MAX_PAGES = 20;

function cookiesFrom(res: Response): string {
  const h = res.headers as Headers & { getSetCookie?: () => string[] };
  const list = h.getSetCookie?.() ?? (res.headers.get("set-cookie") ?? "").split(/,(?=\s*[\w-]+=)/);
  return list
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

function dayforceLocation(p: DayforcePosting): string | null {
  const l = p.postingLocations?.[0];
  if (!l) return null;
  const short = [l.cityName, l.stateCode, l.isoCountryCode].filter(Boolean).join(", ");
  return short || l.formattedAddress?.trim() || null;
}

export async function dayforce(
  rec: MetricsRecorder,
  token: string,
  company: string,
): Promise<RawJob[]> {
  const [ns, board] = token.split("/");
  if (!ns || !board) throw new Error(`Bad Dayforce token "${token}" (want namespace/boardCode)`);
  // The search API wants the CSRF token the board's own page fetches, plus its cookie.
  const csrfRes = await scoutFetch(rec, "dayforce", `${DAYFORCE}/api/auth/csrf`);
  const cookie = cookiesFrom(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
  if (!csrfToken) throw new Error("Dayforce did not return a CSRF token");

  const postings: DayforcePosting[] = [];
  let total = Infinity;
  for (let page = 0; page < DAYFORCE_MAX_PAGES && page * DAYFORCE_PAGE < total; page++) {
    const data = await scoutJson<{ jobPostings?: DayforcePosting[]; maxCount?: number }>(
      rec,
      "dayforce",
      `${DAYFORCE}/api/geo/${encodeURIComponent(ns)}/jobposting/search`,
      {
        method: "POST",
        headers: { "X-CSRF-TOKEN": csrfToken, Cookie: cookie },
        body: JSON.stringify({
          clientNamespace: ns,
          jobBoardCode: board,
          cultureCode: "en-US",
          distanceUnit: 0,
          paginationStart: page * DAYFORCE_PAGE,
        }),
      },
    );
    const list = data.jobPostings ?? [];
    total = data.maxCount ?? list.length;
    postings.push(...list);
    if (list.length < DAYFORCE_PAGE) break;
  }
  return postings.map((p) => ({
    source: "dayforce",
    external_id: String(p.jobPostingId),
    title: p.jobTitle,
    company_name: company,
    location: dayforceLocation(p),
    description: htmlToText(p.jobDescription ?? null),
    apply_url: `${DAYFORCE}/en-US/${ns}/${board}/jobs/${p.jobPostingId}`,
    department: null,
    employment_type_raw: null,
    remote_hint: p.hasVirtualLocation ?? null,
    posted_at: iso(p.postingStartTimestampUTC ?? null),
  }));
}
