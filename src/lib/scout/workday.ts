import { mapLimit, scoutJson, type MetricsRecorder } from "./http.ts";
import { htmlToText, iso } from "./text.ts";
import type { RawJob } from "./types.ts";

/**
 * Workday adapter. Every Workday careers site (…myworkdayjobs.com or
 * …myworkdaysite.com) is backed by the same JSON endpoints the site's own
 * page calls:
 *
 *   POST https://{host}/wday/cxs/{tenant}/{site}/jobs   → list, 20 per page
 *   GET  https://{host}/wday/cxs/{tenant}/{site}{path}  → one posting's detail
 *
 * The list only carries a relative date ("Posted 30+ Days Ago") and no
 * description, so the newest postings also get a detail fetch (exact date,
 * description, schedule, remote locations). Both are capped so one employer
 * with thousands of openings can't stall a run.
 *
 * Token format (stored in scout_companies.ats_token): "{host}/{tenant}/{site}",
 * e.g. "nvidia.wd5.myworkdayjobs.com/nvidia/NVIDIAExternalCareerSite".
 */

const PAGE = 20;
const MAX_LISTED = 400;
const MAX_DETAILED = 40;

type WorkdayListing = {
  title: string;
  externalPath: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
};

type WorkdayDetail = {
  jobPostingInfo?: {
    title?: string;
    jobDescription?: string;
    location?: string;
    additionalLocations?: string[];
    startDate?: string;
    timeType?: string;
    remoteType?: string;
    externalUrl?: string;
    jobReqId?: string;
  };
};

export function parseWorkdayToken(token: string) {
  const [host, tenant, site] = token.split("/");
  if (!host || !tenant || !site) throw new Error(`Bad Workday token "${token}"`);
  return { host, tenant, site, api: `https://${host}/wday/cxs/${tenant}/${site}` };
}

/** "Posted Today" / "Posted Yesterday" / "Posted 3 Days Ago" / "Posted 30+ Days Ago" → ISO date. */
export function workdayPostedOn(text: string | undefined, now = Date.now()): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  const day = 86_400_000;
  if (t.includes("today")) return new Date(now).toISOString();
  if (t.includes("yesterday")) return new Date(now - day).toISOString();
  const m = /(\d+)\+?\s*days?/.exec(t);
  // "30+" means "at least 30"; call it 31 so it reads as over a month old.
  if (m) return new Date(now - (Number(m[1]) + (t.includes("+") ? 1 : 0)) * day).toISOString();
  return null;
}

export async function workday(
  rec: MetricsRecorder,
  token: string,
  company: string,
): Promise<RawJob[]> {
  const { host, site, api } = parseWorkdayToken(token);

  const listed: WorkdayListing[] = [];
  for (let offset = 0; offset < MAX_LISTED; offset += PAGE) {
    const page = await scoutJson<{ jobPostings?: WorkdayListing[] }>(
      rec,
      "workday",
      `${api}/jobs`,
      {
        method: "POST",
        body: JSON.stringify({ appliedFacets: {}, limit: PAGE, offset, searchText: "" }),
      },
    );
    const rows = page.jobPostings ?? [];
    listed.push(...rows);
    if (rows.length < PAGE) break;
  }

  // The list comes newest first; spend the detail budget on the freshest postings.
  const details = new Map<string, WorkdayDetail["jobPostingInfo"]>();
  await mapLimit(listed.slice(0, MAX_DETAILED), 4, async (l) => {
    try {
      const d = await scoutJson<WorkdayDetail>(rec, "workday", `${api}${l.externalPath}`);
      if (d.jobPostingInfo) details.set(l.externalPath, d.jobPostingInfo);
    } catch {
      // A missing detail just means this posting uses the list's data only.
    }
  });

  return listed.map((l) => {
    const d = details.get(l.externalPath);
    // "5 Locations" is a count, not a place.
    const listLocation =
      l.locationsText && !/^\d+\s+locations?$/i.test(l.locationsText) ? l.locationsText : null;
    const locations = [d?.location, ...(d?.additionalLocations ?? [])].filter(Boolean).join(" ");
    return {
      source: "workday",
      external_id: d?.jobReqId || l.bulletFields?.[0] || l.externalPath,
      title: d?.title || l.title,
      company_name: company,
      location: d?.location || listLocation,
      description: htmlToText(d?.jobDescription),
      apply_url: d?.externalUrl || `https://${host}/${site}${l.externalPath}`,
      department: null,
      employment_type_raw: d?.timeType ?? null,
      remote_hint:
        d?.remoteType || locations
          ? /\b(remote|virtual)\b/i.test(`${d?.remoteType ?? ""} ${locations}`)
          : null,
      posted_at: iso(d?.startDate) ?? workdayPostedOn(l.postedOn),
    } satisfies RawJob;
  });
}
