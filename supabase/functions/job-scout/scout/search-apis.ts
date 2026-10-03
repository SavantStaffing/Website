// Generated from src/lib/scout/search-apis.ts by scripts/build-scout-function.mjs. Do not edit.
import { scoutJson, type MetricsRecorder } from "./http.ts";
import { htmlToText, iso } from "./text.ts";
import type { RawJob } from "./types.ts";

/**
 * Scanners for careers sites backed by a public JSON search API. They all
 * share one shape — "page through a search endpoint, map each row" — so each
 * adapter is just: endpoint, page size, row → RawJob. Public data only, the
 * same requests the careers page makes in the browser.
 *
 *   eightfold — Eightfold "PCSX" careers sites. Token = "{host}|{domain}",
 *               e.g. "apply.careers.microsoft.com|microsoft.com".
 *   oracle    — Oracle Recruiting Cloud (Candidate Experience). Token =
 *               "{host}/{siteNumber}" with optional "/{keyword}" filter,
 *               e.g. "eeho.fa.us2.oraclecloud.com/CX_45001/NetSuite".
 *   ultipro   — UKG Pro (UltiPro) job boards. Token = "{tenant}/{boardId}".
 *   amazon    — amazon.jobs search. Token = country code (e.g. "USA").
 */

const MAX_JOBS = 500;

/** Shared pager: calls `fetchPage(offset)` until a short page, the total, or the cap. */
async function paginate<T>(
  pageSize: number,
  fetchPage: (offset: number) => Promise<{ rows: T[]; total?: number }>,
  cap = MAX_JOBS,
): Promise<T[]> {
  const out: T[] = [];
  let total = Infinity;
  for (let offset = 0; offset < Math.min(total, cap); offset += pageSize) {
    const { rows, total: t } = await fetchPage(offset);
    if (t != null) total = t;
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out.slice(0, cap);
}

const secs = (n?: number | null) => (n ? iso(n * 1000) : null);

// ---------------------------------------------------------------- Eightfold

type EightfoldPosition = {
  id: number;
  displayJobId?: string;
  name: string;
  locations?: string[];
  standardizedLocations?: string[];
  postedTs?: number;
  creationTs?: number;
  department?: string;
  workLocationOption?: string;
  positionUrl?: string;
};

export async function eightfold(rec: MetricsRecorder, token: string, company: string): Promise<RawJob[]> {
  const [host, domain] = token.split("|");
  if (!host || !domain) throw new Error(`Bad Eightfold token "${token}"`);
  const rows = await paginate<EightfoldPosition>(10, async (start) => {
    // Eightfold rate-limits bursts (429); space the 10-row pages out.
    if (start) await new Promise((r) => setTimeout(r, 700));
    const data = await scoutJson<{ data?: { count?: number; positions?: EightfoldPosition[] } }>(
      rec,
      "eightfold",
      `https://${host}/api/pcsx/search?domain=${encodeURIComponent(domain)}&query=&location=United%20States&start=${start}&sort_by=timestamp`,
    );
    return { rows: data.data?.positions ?? [], total: data.data?.count };
  }, 200);
  return rows.map((p) => ({
    source: "eightfold",
    external_id: String(p.displayJobId || p.id),
    title: p.name,
    company_name: company,
    location: (p.standardizedLocations ?? p.locations ?? []).join("; ") || null,
    description: null,
    apply_url: `https://${host}${p.positionUrl ?? `/careers/job/${p.id}`}`,
    department: p.department ?? null,
    employment_type_raw: null,
    remote_hint: p.workLocationOption ? /remote/i.test(p.workLocationOption) : null,
    posted_at: secs(p.postedTs ?? p.creationTs),
  }));
}

// ---------------------------------------------------------------- Oracle Recruiting Cloud

type OracleReq = {
  Id: string;
  Title: string;
  PostedDate?: string;
  PrimaryLocation?: string;
  PrimaryLocationCountry?: string;
  WorkplaceTypeCode?: string | null;
  ShortDescriptionStr?: string;
  JobFamily?: string | null;
  JobSchedule?: string | null;
  secondaryLocations?: { Name?: string }[];
};

export async function oracle(rec: MetricsRecorder, token: string, company: string): Promise<RawJob[]> {
  const [host, site, keyword] = token.split("/");
  if (!host || !site) throw new Error(`Bad Oracle token "${token}"`);
  const kw = keyword ? `keyword=${encodeURIComponent(`"${decodeURIComponent(keyword)}"`)},` : "";
  const rows = await paginate<OracleReq>(25, async (offset) => {
    const data = await scoutJson<{ items?: { TotalJobsCount?: number; requisitionList?: OracleReq[] }[] }>(
      rec,
      "oracle",
      `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${site},${kw}limit=25,offset=${offset},sortBy=POSTING_DATES_DESC`,
    );
    const item = data.items?.[0];
    return { rows: item?.requisitionList ?? [], total: item?.TotalJobsCount };
  });
  return rows.map((r) => ({
    source: "oracle",
    external_id: r.Id,
    title: r.Title,
    company_name: company,
    location: [r.PrimaryLocation, ...(r.secondaryLocations ?? []).map((l) => l.Name)].filter(Boolean).join("; ") || null,
    description: r.ShortDescriptionStr?.trim() || null,
    apply_url: `https://${host}/hcmUI/CandidateExperience/en/sites/${site}/job/${r.Id}`,
    department: r.JobFamily ?? null,
    employment_type_raw: r.JobSchedule ?? null,
    remote_hint: r.WorkplaceTypeCode ? /REMOTE/i.test(r.WorkplaceTypeCode) : null,
    posted_at: iso(r.PostedDate),
    country_hint: r.PrimaryLocationCountry === "US" ? "US" : null,
  }));
}

// ---------------------------------------------------------------- UKG Pro (UltiPro)

type UltiproOpp = {
  Id: string;
  Title: string;
  RequisitionNumber?: string;
  FullTime?: boolean;
  JobCategoryName?: string;
  PostedDate?: string;
  BriefDescription?: string;
  Locations?: { Address?: { City?: string; State?: { Code?: string }; Country?: { Code?: string } } }[];
};

export async function ultipro(rec: MetricsRecorder, token: string, company: string): Promise<RawJob[]> {
  const [tenant, board] = token.split("/");
  if (!tenant || !board) throw new Error(`Bad UltiPro token "${token}"`);
  const base = `https://recruiting2.ultipro.com/${tenant}/JobBoard/${board}`;
  const rows = await paginate<UltiproOpp>(50, async (skip) => {
    const data = await scoutJson<{ totalCount?: number; opportunities?: UltiproOpp[] }>(
      rec,
      "ultipro",
      `${base}/JobBoardView/LoadSearchResults`,
      {
        method: "POST",
        body: JSON.stringify({
          opportunitySearch: {
            Top: 50,
            Skip: skip,
            QueryString: "",
            OrderBy: [{ Value: "postedDateDesc", PropertyName: "PostedDate", Ascending: false }],
            Filters: [4, 5, 6].map((f) => ({ t: "TermsSearchFilterDto", fieldName: f, extra: null, values: [] })),
          },
          matchCriteria: { PreferredJobs: [], Educations: [], LicenseAndCertifications: [], Skills: [], hasNoLicenses: false, SkippedSkills: [] },
        }),
      },
    );
    return { rows: data.opportunities ?? [], total: data.totalCount };
  });
  return rows.map((o) => ({
    source: "ultipro",
    external_id: o.Id,
    title: o.Title,
    company_name: company,
    location:
      (o.Locations ?? [])
        .map((l) => [l.Address?.City, l.Address?.State?.Code, l.Address?.Country?.Code].filter(Boolean).join(", "))
        .filter(Boolean)
        .join("; ") || null,
    description: o.BriefDescription?.trim() || null,
    apply_url: `${base}/OpportunityDetail?opportunityId=${o.Id}`,
    department: o.JobCategoryName ?? null,
    employment_type_raw: o.FullTime == null ? null : o.FullTime ? "Full time" : "Part time",
    remote_hint: null,
    posted_at: iso(o.PostedDate),
  }));
}

// ---------------------------------------------------------------- Amazon

type AmazonJob = {
  id_icims: string;
  title: string;
  company_name?: string;
  location?: string;
  normalized_location?: string;
  country_code?: string;
  description?: string;
  basic_qualifications?: string;
  job_category?: string;
  job_path: string;
  job_schedule_type?: string;
  posted_date?: string;
};

export async function amazon(rec: MetricsRecorder, token: string, company: string): Promise<RawJob[]> {
  const country = token || "USA";
  const rows = await paginate<AmazonJob>(100, async (offset) => {
    const data = await scoutJson<{ hits?: number; jobs?: AmazonJob[] }>(
      rec,
      "amazon",
      `https://www.amazon.jobs/en/search.json?result_limit=100&offset=${offset}&country=${encodeURIComponent(country)}&sort=recent`,
    );
    return { rows: data.jobs ?? [], total: data.hits };
  });
  return rows.map((j) => ({
    source: "amazon",
    external_id: j.id_icims,
    title: j.title,
    company_name: company,
    location: j.normalized_location || j.location || null,
    description: htmlToText([j.description, j.basic_qualifications].filter(Boolean).join("<br/><br/>")),
    apply_url: `https://www.amazon.jobs${j.job_path}`,
    department: j.job_category ?? null,
    employment_type_raw: j.job_schedule_type ?? null,
    remote_hint: null,
    posted_at: iso(j.posted_date),
    country_hint: j.country_code === "USA" ? "US" : null,
  }));
}
