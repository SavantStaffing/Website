// Generated from src/lib/scout/staffing-boards.ts by scripts/build-scout-function.mjs. Do not edit.
import { mapLimit, scoutFetch, scoutJson, type MetricsRecorder } from "./http.ts";
import { decodeEntities, htmlToText, iso } from "./text.ts";
import type { PayRange } from "./track.ts";
import type { RawJob } from "./types.ts";

/**
 * Unique scanners for staffing-agency job boards that load their listings in
 * the browser (see unique_scanner_sites). Each replays the requests the
 * board's own page makes; no logins, public data only.
 *
 *   avionte  — Avionte Sonar careers boards (Staffing Network).
 *              Token "{buildIdEnc}/{jobBoardIdEnc}" from the board's iframe:
 *              hire.myavionte.com/app/careers/#/jobs/{b}/{jb}/
 *   smpl     — "Smpl" job boards (Renoir Staffing). Token = board origin,
 *              e.g. https://jobs.renoirstaffing.com. The list API needs a
 *              short-lived ticket (t, h) that the search page embeds.
 *   partners — Partners Personnel's client job board (server-rendered,
 *              htmx). Token = https://jobs.partnerspersonnel.com. ~2,000
 *              postings across ~230 pages, so each scan reads the first
 *              PARTNERS_MAX_PAGES pages.
 */

const UA_HTML = { accept: "text/html", timeoutMs: 20_000 } as const;

/** Hourly vs annual from the size of the number, for boards that don't say. */
const guessUnit = (n: number): PayRange["unit"] => (n < 500 ? "hour" : "year");

// ---------------------------------------------------------------- Avionte

type AvionteBoard = {
  jobPosts?: Record<
    string,
    {
      jobPostIdEnc: string;
      jobTitle: string;
      location: string | null;
      category: string | null;
      postDateUtc: string | null;
      pay: number | null;
      payMin: number | null;
      payMax: number | null;
      jobType: string | null;
      jobId: string | null;
    }
  >;
};

const AVIONTE = "https://hire.myavionte.com";
const AVIONTE_MAX_DESCRIPTIONS = 60;

export async function avionte(
  rec: MetricsRecorder,
  token: string,
  company: string,
): Promise<RawJob[]> {
  const [bId, jbId] = token.split("/");
  if (!bId || !jbId)
    throw new Error(`Bad Avionte token "${token}" (want buildIdEnc/jobBoardIdEnc)`);
  const board = await scoutJson<AvionteBoard>(
    rec,
    "avionte",
    `${AVIONTE}/sonar/v2/jobBoard/${bId}/${jbId}`,
  );
  const posts = Object.values(board.jobPosts ?? {}).sort(
    (a, b) => Date.parse(b.postDateUtc ?? "") - Date.parse(a.postDateUtc ?? ""),
  );

  // Descriptions come one request at a time, and only with the board headers
  // the page's own http interceptor adds. Newest postings first.
  const headers = {
    "X-Compas-Careers-BuildIdEnc": bId,
    "X-Compas-Careers-JobBoardIdEnc": jbId,
  };
  const descriptions = new Map<string, string | null>();
  await mapLimit(posts.slice(0, AVIONTE_MAX_DESCRIPTIONS), 4, async (p) => {
    try {
      const d = await scoutJson<{ description?: string } | string>(
        rec,
        "avionte",
        `${AVIONTE}/sonar/v2/jobBoard/jobPost/${p.jobPostIdEnc}/description`,
        { headers },
      );
      descriptions.set(p.jobPostIdEnc, htmlToText(typeof d === "string" ? d : d.description));
    } catch {
      // Listing still usable without its description.
    }
  });

  return posts.map((p) => {
    const lo = p.payMin && p.payMin > 0 ? p.payMin : null;
    const hi = p.payMax && p.payMax > 0 ? p.payMax : null;
    const single = p.pay && p.pay > 0 ? p.pay : null;
    const min = lo ?? single;
    const max = hi ?? single;
    return {
      source: "avionte",
      external_id: p.jobPostIdEnc,
      title: p.jobTitle,
      company_name: company,
      location: p.location?.trim() || null,
      description: descriptions.get(p.jobPostIdEnc) ?? null,
      apply_url: `${AVIONTE}/app/careers/#/job/${p.jobPostIdEnc}`,
      department: p.category,
      employment_type_raw: p.jobType,
      remote_hint: null,
      posted_at: iso(p.postDateUtc),
      pay: max !== null ? { min, max, unit: guessUnit(max) } : null,
    } satisfies RawJob;
  });
}

// ---------------------------------------------------------------- Smpl job boards

type SmplPost = {
  POST_ID: number;
  POST_TITLE: string;
  POST_LOCATION: string | null;
  POST_DESCRIPTION: string | null;
  POST_REQUIREMENTS: string | null;
  POST_SEO_URL: string | null;
  POST_DATE: string | null;
  POST_EXPIRATION_DATE: string | null;
  POST_CATEGORY: string | null;
  POST_EMPLOYMENT_TYPE: string | null;
  POST_PAYRATE: string | null;
  POST_SALARY_FROM: string | null;
  POST_SALARY_TO: string | null;
  POST_REMOTE_ALLOW: number | null;
};

const SMPL_PAGE = 100;
const SMPL_MAX = 500;

/** "$22/hr", "$55,000 - $65,000", "DOE" → a pay range, when there is one. */
export function parsePayText(text: string | null | undefined): PayRange | null {
  if (!text) return null;
  const nums = [...text.matchAll(/\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?/gi)]
    .map((m) => Number(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1))
    .filter((n) => n > 0);
  if (!nums.length) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const unit: PayRange["unit"] = /hour|hr\b/i.test(text)
    ? "hour"
    : /year|yr\b|annual|salary/i.test(text)
      ? "year"
      : /week/i.test(text)
        ? "week"
        : guessUnit(max);
  return { min, max, unit };
}

export async function smpl(
  rec: MetricsRecorder,
  token: string,
  company: string,
): Promise<RawJob[]> {
  const origin = token.replace(/\/+$/, "");
  const page = await (
    await scoutFetch(rec, "smpl", `${origin}/index.smpl?arg=jb_search_results&view=0`, UA_HTML)
  ).text();
  const t = /name="t"\s+value="(\d+)"/.exec(page)?.[1];
  const h = /name="h"\s+value="([0-9a-f]{32})"/.exec(page)?.[1];
  const pid = /name="pid"\s+value="([\w-]+)"/.exec(page)?.[1] ?? "gwt";
  if (!t || !h) throw new Error("Smpl board: search ticket not found on the page");

  const posts: SmplPost[] = [];
  for (let first = 0; first < SMPL_MAX; first += SMPL_PAGE) {
    const url =
      `${origin}/json/index.smpl?arg=list_posts&pp=${SMPL_PAGE}&pid=${pid}&h=${h}&t=${t}` +
      `&first=${first}&total=0&view=0&action=1`;
    // The response has a trailing comma before its closing brace; tolerate it.
    const text = await (await scoutFetch(rec, "smpl", url)).text();
    const body = JSON.parse(text.replace(/,\s*([}\]])/g, "$1")) as {
      ResultSet?: { ticket?: { msg?: string }; list?: SmplPost[]; list_meta?: { total?: string } };
    };
    const rs = body.ResultSet;
    if (rs?.ticket?.msg) throw new Error(`Smpl board: ${rs.ticket.msg}`);
    const batch = rs?.list ?? [];
    posts.push(...batch);
    if (batch.length < SMPL_PAGE || posts.length >= Number(rs?.list_meta?.total ?? 0)) break;
  }

  const today = new Date().toISOString().slice(0, 10);
  return posts
    .filter((p) => !p.POST_EXPIRATION_DATE || p.POST_EXPIRATION_DATE >= today)
    .map((p) => {
      const description = [htmlToText(p.POST_DESCRIPTION), htmlToText(p.POST_REQUIREMENTS)]
        .filter(Boolean)
        .join("\n\n");
      const salary =
        p.POST_SALARY_FROM || p.POST_SALARY_TO
          ? `${p.POST_SALARY_FROM ?? ""} - ${p.POST_SALARY_TO ?? ""}`
          : p.POST_PAYRATE;
      return {
        source: "smpl",
        external_id: String(p.POST_ID),
        title: decodeEntities(p.POST_TITLE).trim(),
        company_name: company,
        location: p.POST_LOCATION?.trim() || null,
        description: description || null,
        apply_url: p.POST_SEO_URL || `${origin}/index.smpl?arg=jb_details&POST_ID=${p.POST_ID}`,
        department: null,
        employment_type_raw: p.POST_EMPLOYMENT_TYPE || p.POST_CATEGORY || null,
        remote_hint: p.POST_REMOTE_ALLOW ? true : null,
        posted_at: iso(p.POST_DATE),
        pay: parsePayText(salary),
      } satisfies RawJob;
    });
}

// ---------------------------------------------------------------- Partners Personnel

const PARTNERS_MAX_PAGES = 6; // 9 postings per page
const PARTNERS_MAX_DETAILS = 54;

type PartnersCard = {
  id: string;
  title: string;
  location: string | null;
  slug: string | null;
  pills: string[];
};

/** Job cards from one results page (or the board's home page). */
export function partnersCards(html: string): PartnersCard[] {
  const cards: PartnersCard[] = [];
  const starts = [...html.matchAll(/hx-get="\/job\/(\d+)\/"/g)];
  for (let i = 0; i < starts.length; i++) {
    const chunk = html.slice(starts[i].index, starts[i + 1]?.index ?? html.length);
    const title = /montserrat-semibold[^>]*>([^<]+)</.exec(chunk)?.[1];
    if (!title) continue;
    const loc = /bi-geo-alt[^>]*><\/i>\s*([^<]+?)\s*</.exec(chunk)?.[1] ?? null;
    cards.push({
      id: starts[i][1],
      title: decodeEntities(title).trim(),
      location: loc ? decodeEntities(loc).trim() : null,
      slug: /href="\/job-detail\/([^"/]+)\/"/.exec(chunk)?.[1] ?? null,
      pills: [...chunk.matchAll(/job-card-pill badge">([^<]+)</g)].map((m) =>
        decodeEntities(m[1]).trim(),
      ),
    });
  }
  return cards;
}

/** The "Job Description" tab of a /job/{id}/ fragment. */
export function partnersDescription(html: string, id: string): string | null {
  const start = html.indexOf(`id="description${id}"`);
  if (start < 0) return null;
  const end = html.indexOf("Branch Details Content", start);
  const body = html.slice(html.indexOf(">", start) + 1, end > 0 ? end : undefined);
  return htmlToText(body);
}

export async function partners(
  rec: MetricsRecorder,
  token: string,
  company: string,
): Promise<RawJob[]> {
  const origin = token.replace(/\/+$/, "");
  const byId = new Map<string, PartnersCard>();
  for (let page = 1; page <= PARTNERS_MAX_PAGES; page++) {
    const html = await (
      await scoutFetch(rec, "partners", `${origin}/search-jobs/?&page=${page}`, UA_HTML)
    ).text();
    const cards = partnersCards(html);
    if (!cards.length) break;
    for (const c of cards) byId.set(c.id, c);
  }
  const cards = [...byId.values()];

  const descriptions = new Map<string, string | null>();
  await mapLimit(cards.slice(0, PARTNERS_MAX_DETAILS), 4, async (c) => {
    try {
      const html = await (
        await scoutFetch(rec, "partners", `${origin}/job/${c.id}/`, UA_HTML)
      ).text();
      descriptions.set(c.id, partnersDescription(html, c.id));
    } catch {
      // Card data still stands on its own.
    }
  });

  return cards.map((c) => {
    const payPill = c.pills.find((p) => /\$\s*\d/.test(p)) ?? null;
    const workplace = c.pills.find((p) => /on site|remote|hybrid/i.test(p)) ?? null;
    return {
      source: "partners",
      external_id: c.id,
      title: c.title,
      company_name: company,
      location: c.location,
      description: descriptions.get(c.id) ?? null,
      apply_url: c.slug ? `${origin}/job-detail/${c.slug}/` : `${origin}/`,
      department: null,
      // A staffing agency's client postings: temp assignments unless the text says otherwise.
      employment_type_raw: null,
      remote_hint: workplace ? /remote/i.test(workplace) : null,
      posted_at: null,
      pay: parsePayText(payPill),
    } satisfies RawJob;
  });
}
