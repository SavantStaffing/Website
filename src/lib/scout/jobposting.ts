import { mapLimit, scoutFetch, type MetricsRecorder } from "./http.ts";
import { decodeEntities, htmlToText, iso } from "./text.ts";
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

const MAX_JOB_PAGES = 60;
const ICIMS_MAX_LIST_PAGES = 8;

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
    return extractJobPostings(html)
      .map((p) =>
        jobFromPosting(opts.ignoreValidThrough ? { ...p, validThrough: undefined } : p, {
          source,
          pageUrl: url,
          company,
        }),
      )
      .filter((j): j is RawJob => j !== null)
      .map((j) => (enrich ? enrich(j, html) : j));
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

/** Job-page URLs from the site's sitemap (one level of sitemap index followed). */
async function sitemapJobUrls(rec: MetricsRecorder, pageUrl: string): Promise<string[]> {
  const origin = new URL(pageUrl).origin;
  const locs = (xml: string) =>
    [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decodeEntities(m[1]));
  const index = await fetchHtml(rec, "jsonld", `${origin}/sitemap.xml`);
  if (!index) return [];
  let urls = locs(index);
  if (/<sitemapindex/i.test(index)) {
    const children = urls.filter((u) => /job|career|position|opening/i.test(u)).slice(0, 3);
    urls = (await Promise.all(children.map((c) => fetchHtml(rec, "jsonld", c)))).flatMap((x) =>
      x ? locs(x) : [],
    );
  }
  return urls.filter((u) => JOB_PATH.test(new URL(u, origin).pathname));
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

  let links = jobLinks(html, token);
  if (links.length < 3) links = [...new Set([...links, ...(await sitemapJobUrls(rec, token))])];
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
