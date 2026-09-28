import { mapLimit, scoutFetch, type MetricsRecorder } from "./http.ts";
import { decodeEntities, htmlToText, iso } from "./text.ts";
import type { PayRange } from "./track.ts";
import type { JobSource, RawJob } from "./types.ts";

/**
 * Careers sites without a supported ATS API. Many publish each opening with
 * schema.org `JobPosting` markup (the structured data Google for Jobs reads),
 * so no LLM is needed: find the job pages, read their markup.
 *
 *   icims   — iCIMS portals (careers-acme.icims.com): paged search list →
 *             job pages, which always carry JobPosting markup.
 *   jsonld  — any other careers site: markup on the page itself, links that
 *             look like job pages, or the site's sitemap.
 *
 * Page fetches are capped per company so a large site can't stall a run.
 */

let MAX_JOB_PAGES = 100;
const ICIMS_MAX_LIST_PAGES = 8;

/**
 * Lower the per-company page cap. The scheduled Edge Function runs with a
 * 2s CPU budget per call, and parsing job pages is the costly part.
 */
export function setJobPageLimit(n: number) {
  MAX_JOB_PAGES = Math.max(10, Math.floor(n));
}

// ---------------------------------------------------------------- JobPosting markup

type Json = Record<string, unknown>;

const asArray = <T>(v: T | T[] | undefined | null): T[] =>
  v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = decodeEntities(v).trim();
  // iCIMS fills unknown fields with the literal "UNAVAILABLE".
  return s && s.toUpperCase() !== "UNAVAILABLE" ? s : null;
};

const isType = (o: Json, type: string) =>
  asArray(o["@type"] as string | string[]).some(
    (t) => String(t).toLowerCase() === type.toLowerCase(),
  );

/** Every JobPosting object in a page's JSON-LD, however it's nested. */
export function extractJobPostings(html: string): Json[] {
  const out: Json[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const o = node as Json;
    if (isType(o, "JobPosting")) out.push(o);
    if (o["@graph"]) visit(o["@graph"]);
    if (o.itemListElement) visit(o.itemListElement);
    if (o.item) visit(o.item);
  };
  for (const m of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const raw = m[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "").trim();
    try {
      visit(JSON.parse(raw));
    } catch {
      // Some sites ship slightly broken JSON-LD; skip that block.
    }
  }
  return out;
}

function location(p: Json): { text: string | null; remote: boolean | null } {
  const remote = String(p.jobLocationType ?? "").toUpperCase() === "TELECOMMUTE" ? true : null;
  for (const place of asArray(p.jobLocation as Json | Json[])) {
    const a = (place?.address ?? {}) as Json;
    const country =
      typeof a.addressCountry === "object" && a.addressCountry
        ? str((a.addressCountry as Json).name)
        : str(a.addressCountry);
    const text = [str(a.addressLocality), str(a.addressRegion), country].filter(Boolean).join(", ");
    if (text) return { text, remote };
  }
  return { text: remote ? "Remote" : null, remote };
}

const PAY_UNITS: Record<string, PayRange["unit"]> = {
  HOUR: "hour",
  HOURLY: "hour",
  DAY: "day",
  DAILY: "day",
  WEEK: "week",
  WEEKLY: "week",
  MONTH: "month",
  MONTHLY: "month",
  YEAR: "year",
  YEARLY: "year",
  ANNUAL: "year",
  ANNUALLY: "year",
};

const num = (v: unknown): number | null => {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[,$]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** schema.org baseSalary (MonetaryAmount → QuantitativeValue) → a pay range. */
export function payFromPosting(p: Json): PayRange | null {
  const salary = asArray(p.baseSalary as Json | Json[])[0];
  if (!salary || typeof salary !== "object") return null;
  const value = salary.value;
  const q = (value && typeof value === "object" ? value : salary) as Json;
  const single = num(typeof value === "object" ? q.value : value);
  const min = num(q.minValue) ?? single;
  const max = num(q.maxValue) ?? single;
  if (min === null && max === null) return null;
  const unit = PAY_UNITS[String(q.unitText ?? salary.unitText ?? "").toUpperCase()];
  // No unit: small numbers are hourly rates, big ones salaries.
  return { min, max, unit: unit ?? ((max ?? min)! < 500 ? "hour" : "year") };
}

/** One JobPosting object → the scout's raw job shape. Null if expired or unusable. */
export function jobFromPosting(
  p: Json,
  ctx: { source: JobSource; pageUrl: string; company: string; now?: number },
): RawJob | null {
  const title = str(p.title);
  if (!title) return null;
  const validThrough = iso(p.validThrough as string);
  if (validThrough && new Date(validThrough).getTime() < (ctx.now ?? Date.now())) return null;

  const url = str(p.url) ?? ctx.pageUrl;
  const identifier = p.identifier as Json | string | undefined;
  const id =
    (typeof identifier === "object" && identifier ? str(identifier.value) : str(identifier)) ?? url;
  const loc = location(p);
  const org = p.hiringOrganization as Json | undefined;

  return {
    source: ctx.source,
    external_id: id,
    title,
    // The name the admin configured wins; markup names are often all-caps or legal entities.
    company_name: ctx.company || (org && str(org.name)) || "Unknown company",
    location: loc.text,
    description: htmlToText(typeof p.description === "string" ? p.description : null),
    apply_url: url,
    department: null,
    employment_type_raw: asArray(p.employmentType as string | string[]).join(" ") || null,
    remote_hint: loc.remote,
    posted_at: iso(p.datePosted as string),
    industry_raw: str(p.industry),
    pay: payFromPosting(p),
  };
}

// ---------------------------------------------------------------- Phenom job pages

/** The JSON object literal that starts at `from` (brace-matched, strings respected). */
function balancedJson(text: string, from: number): unknown {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try {
        return JSON.parse(text.slice(from, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Phenom-hosted careers sites (e.g. jobs.aerotek.com) publish JobPosting
 * markup only on some pages, but every job page embeds its full record in
 * `phApp.ddo.jobDetail.data.job` for the page's own script.
 */
export function phenomJob(html: string, ctx: { pageUrl: string; company: string }): RawJob | null {
  const at = html.indexOf("phApp.ddo = ");
  if (at < 0) return null;
  const ddo = balancedJson(html, html.indexOf("{", at)) as Json | null;
  const detail = (ddo?.jobDetail as Json | undefined)?.data as Json | undefined;
  const job = detail?.job as Json | undefined;
  const title = job && str(job.title);
  if (!job || !title) return null;
  const open = str(job.deltaPostingStatus);
  if (open && open.toLowerCase() !== "open") return null;
  const remote = str(job.remoteOnsite);
  const unit = PAY_UNITS[String(job.salaryPer ?? "").toUpperCase()] ?? null;
  const min = num(job.salaryFrom);
  const max = num(job.salaryTo);
  return {
    source: "jsonld",
    external_id: str(job.jobId) ?? str(job.reqId) ?? ctx.pageUrl,
    title,
    company_name: ctx.company || str(job.companyName) || "Unknown company",
    location: str(job.location) ?? str(job.cityStateCountry),
    description: htmlToText(typeof job.description === "string" ? job.description : null),
    apply_url: str(job.jobDescriptionpageUrl) ?? ctx.pageUrl,
    department: str(job.category),
    employment_type_raw: str(job.type),
    remote_hint: remote ? /remote/i.test(remote) : null,
    posted_at: iso(job.postedDate as string),
    industry_raw: str(job.industry),
    pay: (min ?? max) !== null && unit ? { min, max, unit } : null,
  };
}

// ---------------------------------------------------------------- crawling helpers

async function fetchHtml(
  rec: MetricsRecorder,
  source: string,
  url: string,
): Promise<string | null> {
  try {
    const res = await scoutFetch(rec, source, url, { accept: "text/html", timeoutMs: 15_000 });
    return await res.text();
  } catch {
    return null;
  }
}

async function postingsFromPages(
  rec: MetricsRecorder,
  source: JobSource,
  urls: string[],
  company: string,
  /** Platform-specific fixes applied to each job using its page HTML. */
  enrich?: (job: RawJob, html: string) => RawJob,
  opts: { ignoreValidThrough?: boolean } = {},
): Promise<RawJob[]> {
  const pages = await mapLimit(urls.slice(0, MAX_JOB_PAGES), 4, async (url) => {
    const html = await fetchHtml(rec, source, url);
    if (!html) return [];
    const jobs = extractJobPostings(html)
      .map((p) =>
        jobFromPosting(opts.ignoreValidThrough ? { ...p, validThrough: undefined } : p, {
          source,
          pageUrl: url,
          company,
        }),
      )
      .filter((j): j is RawJob => j !== null);
    if (jobs.length === 0 && source === "jsonld") {
      const ph = phenomJob(html, { pageUrl: url, company });
      if (ph) jobs.push(ph);
    }
    return jobs.map((j) => (enrich ? enrich(j, html) : j));
  });
  const byId = new Map<string, RawJob>();
  for (const j of pages.flat()) if (!byId.has(j.external_id)) byId.set(j.external_id, j);
  return [...byId.values()];
}

const JOB_PATH =
  /\/(jobs?|careers?|positions?|openings?|vacanc(?:y|ies)|requisitions?|opportunit(?:y|ies)|job-details?)\/[^/?#]+/i;

/** Links on a page that look like individual job pages on the same site. */
export function jobLinks(html: string, pageUrl: string): string[] {
  const base = new URL(pageUrl);
  const root = base.hostname.split(".").slice(-2).join(".");
  const found = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    let u: URL;
    try {
      u = new URL(decodeEntities(m[1]), base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || !u.hostname.endsWith(root)) continue;
    if (!JOB_PATH.test(u.pathname) || u.pathname === base.pathname) continue;
    u.hash = "";
    found.add(u.toString());
  }
  return [...found];
}

type SitemapEntry = { url: string; lastmod: number };

function sitemapEntries(xml: string): SitemapEntry[] {
  return [...xml.matchAll(/<(?:url|sitemap)>([\s\S]*?)<\/(?:url|sitemap)>/gi)].flatMap((m) => {
    const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/i.exec(m[1]);
    if (!loc) return [];
    const mod = /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i.exec(m[1]);
    return [{ url: decodeEntities(loc[1]), lastmod: mod ? Date.parse(mod[1]) || 0 : 0 }];
  });
}

// A job page's path has an id in it: /jobs/312/pr-1545626…, /job/JP-006290649/…
const JOB_ID_SEGMENT = /\/[^/]*\d{4,}[^/]*(?:\/|$)/;

/**
 * Job-page URLs from the site's sitemaps, newest first. Sitemaps are found
 * through robots.txt as well as /sitemap.xml, and sitemap indexes are
 * followed two levels deep (preferring children named for jobs), since
 * large careers sites (Randstad, Phenom-hosted sites like Aerotek) nest them.
 */
export async function sitemapJobUrls(rec: MetricsRecorder, pageUrl: string): Promise<string[]> {
  const { origin, pathname } = new URL(pageUrl);
  // Multi-region sites (jobs.aerotek.com/us/en vs /ca/fr) keep one sitemap per
  // region; stay in the careers page's own.
  const section = /^\/[a-z]{2}(?:[-_/][a-z]{2})?(?=\/|$)/i.exec(pathname)?.[0] ?? null;
  const inSection = (u: string) =>
    !!section && new URL(u, origin).pathname.startsWith(`${section}/`);
  const robots = await fetchHtml(rec, "jsonld", `${origin}/robots.txt`);
  const declared = [...(robots ?? "").matchAll(/^\s*sitemap:\s*(\S+)/gim)]
    .map((m) => m[1])
    .filter((u) => u.startsWith(origin));
  const roots = [
    ...new Set([
      ...declared.filter(inSection),
      ...(section
        ? [`${origin}${section}/sitemap_index.xml`, `${origin}${section}/sitemap.xml`]
        : []),
      ...declared.filter((u) => !inSection(u)),
      `${origin}/sitemap.xml`,
    ]),
  ].slice(0, 4);

  const pages: SitemapEntry[] = [];
  const visit = async (url: string, depth: number) => {
    const xml = await fetchHtml(rec, "jsonld", url);
    if (!xml) return;
    const entries = sitemapEntries(xml);
    if (!/<sitemapindex/i.test(xml)) return void pages.push(...entries);
    if (depth >= 2) return;
    const jobby = (u: string) =>
      /jobs?(?:[-_.]|\.xml)|job-?posting|position|opening|vacanc/i.test(u);
    // Skip job *search* sitemaps (categories, locations): they list listing pages, not jobs.
    const listing = (u: string) => /categor|geo|location|query|search|city|state/i.test(u);
    const named = entries.filter((e) => jobby(e.url) && !listing(e.url));
    const children = (named.length ? named : entries.filter((e) => !listing(e.url))).slice(0, 5);
    for (const c of children) await visit(c.url, depth + 1);
  };
  for (const r of roots) {
    await visit(r, 0);
    if (pages.length) break;
  }

  let jobPages = pages.filter((e) => JOB_PATH.test(new URL(e.url, origin).pathname));
  if (jobPages.some((e) => inSection(e.url))) jobPages = jobPages.filter((e) => inSection(e.url));
  // Prefer URLs that carry a job id; a sitemap also lists search/category pages.
  const withId = jobPages.filter((e) => JOB_ID_SEGMENT.test(new URL(e.url, origin).pathname));
  return [
    ...new Set(
      (withId.length ? withId : jobPages).sort((a, b) => b.lastmod - a.lastmod).map((e) => e.url),
    ),
  ];
}

// ---------------------------------------------------------------- adapters

/**
 * Generic careers site. Token = the careers page URL. Tries, in order: markup
 * on that page, job-looking links on it, then the sitemap.
 */
export async function jsonld(
  rec: MetricsRecorder,
  token: string,
  company: string,
): Promise<RawJob[]> {
  const html = await fetchHtml(rec, "jsonld", token);
  if (!html) return [];
  const onPage = extractJobPostings(html)
    .map((p) => jobFromPosting(p, { source: "jsonld", pageUrl: token, company }))
    .filter((j): j is RawJob => j !== null);
  if (onPage.length > 1) return onPage;

  // Links carrying a job id are real postings; a careers hub mostly links to
  // category and search pages ("/jobs/t-temporary/"), which have no markup.
  const pageLinks = jobLinks(html, token);
  const idLinks = pageLinks.filter((u) => JOB_ID_SEGMENT.test(new URL(u).pathname));
  let links = idLinks.length >= 3 ? idLinks : pageLinks;
  if (idLinks.length < 3) {
    const fromSitemap = await sitemapJobUrls(rec, token);
    if (fromSitemap.length) links = [...new Set([...idLinks, ...fromSitemap])];
  }
  const crawled = await postingsFromPages(rec, "jsonld", links, company);
  return crawled.length ? crawled : onPage;
}

/** iCIMS portal. Token = the portal subdomain, e.g. "careers-acme". */
export async function icims(
  rec: MetricsRecorder,
  token: string,
  company: string,
): Promise<RawJob[]> {
  const base = `https://${token}.icims.com`;
  const links = new Set<string>();
  for (let page = 0; page < ICIMS_MAX_LIST_PAGES && links.size < MAX_JOB_PAGES; page++) {
    const html = await fetchHtml(rec, "icims", `${base}/jobs/search?ss=1&in_iframe=1&pr=${page}`);
    if (!html) break;
    const before = links.size;
    for (const m of html.matchAll(
      /href=["'](https:\/\/[^"']+\.icims\.com\/jobs\/\d+\/[^"'?#]+\/job)/gi,
    )) {
      links.add(`${decodeEntities(m[1])}?in_iframe=1`);
    }
    if (links.size === before) break; // no new jobs on this page: past the end
  }
  // iCIMS generates datePosted/validThrough relative to the moment the page
  // is served (always "2 years ago" / "1 year from now"), so neither is real:
  // drop the date and let first-seen tracking age the posting. Its markup
  // location is usually "UNAVAILABLE"; the page header has the real one.
  return postingsFromPages(
    rec,
    "icims",
    [...links],
    company,
    (job, html) => ({
      ...job,
      posted_at: null,
      location: job.location ?? icimsHeaderLocation(html),
    }),
    { ignoreValidThrough: true },
  );
}

/** The "Location" field in an iCIMS job page header. */
export function icimsHeaderLocation(html: string): string | null {
  const m =
    /field-label[^>]*>\s*(?:Job\s+)?Locations?\s*<\/span>[\s\S]{0,200}?iCIMS_JobHeaderData[^>]*>\s*(?:<span[^>]*>)?\s*([^<]+?)\s*</i.exec(
      html,
    );
  return m ? decodeEntities(m[1]).trim() || null : null;
}
