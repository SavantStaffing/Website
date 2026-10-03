import { scoutJson, type MetricsRecorder } from "./http.ts";
import { icims, jsonld } from "./jobposting.ts";
import { avionte, partners, smpl } from "./staffing-boards.ts";
import { dayforce, phenom, successfactors } from "./enterprise-ats.ts";
import { htmlToText, iso } from "./text.ts";
import { workday } from "./workday.ts";
import type { AtsPlatform, BoardSource, RawJob } from "./types.ts";

/**
 * "Call endpoint" + "Map into site schema". One adapter per ATS, each using
 * that ATS's public, documented job-board endpoint — no scraping, no auth.
 * Adapters only reshape data; validation, refinement and ghost detection
 * happen later in the pipeline so every source is judged the same way.
 */

// ---------------------------------------------------------------- Greenhouse
type GreenhouseJob = {
  id: number;
  title: string;
  updated_at?: string;
  first_published?: string;
  location?: { name?: string };
  absolute_url?: string;
  content?: string;
  company_name?: string;
  departments?: { name: string }[];
  metadata?: { name: string; value: unknown }[] | null;
};

async function greenhouse(rec: MetricsRecorder, token: string, company: string): Promise<RawJob[]> {
  const data = await scoutJson<{ jobs: GreenhouseJob[] }>(
    rec,
    "greenhouse",
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`,
  );
  return (data.jobs ?? []).map((j) => {
    const typeMeta = j.metadata?.find((m) => /employment|job type|time type/i.test(m.name));
    return {
      source: "greenhouse",
      external_id: String(j.id),
      title: j.title,
      company_name: j.company_name || company,
      location: j.location?.name?.trim() || null,
      description: htmlToText(j.content),
      apply_url: j.absolute_url ?? null,
      department: j.departments?.[0]?.name ?? null,
      employment_type_raw: typeof typeMeta?.value === "string" ? typeMeta.value : null,
      remote_hint: null,
      posted_at: iso(j.first_published ?? j.updated_at),
    };
  });
}

// ---------------------------------------------------------------- Lever
type LeverJob = {
  id: string;
  text: string;
  createdAt?: number;
  hostedUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  additionalPlain?: string;
  workplaceType?: string;
  categories?: { commitment?: string; department?: string; team?: string; location?: string };
};

async function lever(rec: MetricsRecorder, token: string, company: string): Promise<RawJob[]> {
  const data = await scoutJson<LeverJob[]>(
    rec,
    "lever",
    `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`,
  );
  return (data ?? []).map((j) => ({
    source: "lever",
    external_id: j.id,
    title: j.text,
    company_name: company,
    location: j.categories?.location?.trim() || null,
    description:
      [j.descriptionPlain, j.additionalPlain].filter(Boolean).join("\n\n").trim() || null,
    apply_url: j.applyUrl ?? j.hostedUrl ?? null,
    department: j.categories?.department ?? j.categories?.team ?? null,
    employment_type_raw: j.categories?.commitment ?? null,
    remote_hint: j.workplaceType ? j.workplaceType === "remote" : null,
    posted_at: iso(j.createdAt),
  }));
}

// ---------------------------------------------------------------- Ashby
type AshbyJob = {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  isRemote?: boolean;
  workplaceType?: string;
  publishedAt?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  isListed?: boolean;
};

async function ashby(rec: MetricsRecorder, token: string, company: string): Promise<RawJob[]> {
  const data = await scoutJson<{ jobs: AshbyJob[] }>(
    rec,
    "ashby",
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`,
  );
  return (data.jobs ?? [])
    .filter((j) => j.isListed !== false)
    .map((j) => ({
      source: "ashby",
      external_id: j.id,
      title: j.title,
      company_name: company,
      location: j.location?.trim() || null,
      description: j.descriptionPlain?.trim() || null,
      apply_url: j.applyUrl ?? j.jobUrl ?? null,
      department: j.department ?? j.team ?? null,
      employment_type_raw: j.employmentType ?? null,
      remote_hint: j.isRemote ?? (j.workplaceType ? /remote/i.test(j.workplaceType) : null),
      posted_at: iso(j.publishedAt),
    }));
}

// ---------------------------------------------------------------- SmartRecruiters
type SmartRecruitersJob = {
  id: string;
  name: string;
  releasedDate?: string;
  company?: { name?: string; identifier?: string };
  location?: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
    fullLocation?: string;
  };
  industry?: { label?: string };
  department?: { label?: string };
  function?: { label?: string };
  typeOfEmployment?: { label?: string };
};

async function smartrecruiters(
  rec: MetricsRecorder,
  token: string,
  company: string,
): Promise<RawJob[]> {
  const out: RawJob[] = [];
  // The list endpoint pages at 100; cap at 5 pages so one huge employer can't
  // eat the whole run.
  for (let offset = 0; offset < 500; offset += 100) {
    const data = await scoutJson<{ content: SmartRecruitersJob[]; totalFound: number }>(
      rec,
      "smartrecruiters",
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(token)}/postings?limit=100&offset=${offset}`,
    );
    for (const j of data.content ?? []) {
      const loc = j.location;
      out.push({
        source: "smartrecruiters",
        external_id: j.id,
        title: j.name,
        company_name: j.company?.name || company,
        location:
          (loc?.fullLocation ?? [loc?.city, loc?.region, loc?.country].join(", "))
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
            .join(", ") || null,
        // The list endpoint has no description; the ghost detector treats that
        // as "unknown", not "empty" (see ghost.ts).
        description: null,
        apply_url: `https://jobs.smartrecruiters.com/${j.company?.identifier ?? token}/${j.id}`,
        department: j.department?.label ?? j.function?.label ?? null,
        employment_type_raw: j.typeOfEmployment?.label ?? null,
        remote_hint: loc?.remote ?? null,
        posted_at: iso(j.releasedDate),
        industry_raw: j.industry?.label ?? null,
      });
    }
    if (!data.content?.length || offset + 100 >= (data.totalFound ?? 0)) break;
  }
  return out;
}

// ---------------------------------------------------------------- Workable
type WorkableJob = {
  title: string;
  shortcode: string;
  employment_type?: string;
  telecommuting?: boolean;
  department?: string;
  url?: string;
  application_url?: string;
  published_on?: string;
  created_at?: string;
  city?: string;
  state?: string;
  country?: string;
  industry?: string;
  description?: string;
};

async function workable(rec: MetricsRecorder, token: string, company: string): Promise<RawJob[]> {
  const data = await scoutJson<{ name?: string; jobs: WorkableJob[] }>(
    rec,
    "workable",
    `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(token)}?details=true`,
  );
  return (data.jobs ?? []).map((j) => ({
    source: "workable",
    external_id: j.shortcode,
    title: j.title,
    company_name: data.name || company,
    location: [j.city, j.state, j.country].filter(Boolean).join(", ") || null,
    description: htmlToText(j.description),
    apply_url: j.application_url ?? j.url ?? null,
    department: j.department || null,
    employment_type_raw: j.employment_type ?? null,
    remote_hint: j.telecommuting ?? null,
    posted_at: iso(j.published_on ?? j.created_at),
    industry_raw: j.industry ?? null,
  }));
}

export const ATS_ADAPTERS: Record<
  AtsPlatform,
  (rec: MetricsRecorder, token: string, company: string) => Promise<RawJob[]>
> = {
  greenhouse,
  lever,
  ashby,
  smartrecruiters,
  workable,
  workday,
  icims,
  jsonld,
  avionte,
  smpl,
  partners,
  successfactors,
  phenom,
  dayforce,
};

// ---------------------------------------------------------------- JobSpy (job boards)
/**
 * LinkedIn / Indeed / Google / Glassdoor / ZipRecruiter go through a separate
 * JobSpy service (services/jobspy) because JobSpy is a Python library. Off
 * unless JOBSPY_URL is set AND the admin has enabled the board. These sites'
 * terms prohibit automated scraping — see services/jobspy/README.md.
 */
type JobSpyRow = {
  id?: string;
  site: BoardSource;
  job_url: string;
  job_url_direct?: string | null;
  title: string;
  company?: string | null;
  location?: string | null;
  date_posted?: string | null;
  job_type?: string | null;
  is_remote?: boolean | null;
  description?: string | null;
  company_industry?: string | null;
};

export async function jobspy(
  rec: MetricsRecorder,
  baseUrl: string,
  token: string | null,
  query: { search_term: string; location?: string; sites: BoardSource[]; hours_old?: number },
): Promise<RawJob[]> {
  const rows = await scoutJson<JobSpyRow[]>(rec, "jobspy", `${baseUrl.replace(/\/$/, "")}/scrape`, {
    method: "POST",
    body: JSON.stringify({ results_wanted: 50, hours_old: 72, ...query }),
    timeoutMs: 120_000,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return rows.map((r) => ({
    source: r.site,
    external_id: r.id || r.job_url,
    title: r.title,
    company_name: r.company || "Unknown company",
    location: r.location || null,
    description: r.description || null,
    apply_url: r.job_url_direct || r.job_url,
    department: null,
    employment_type_raw: r.job_type || null,
    remote_hint: r.is_remote ?? null,
    posted_at: iso(r.date_posted),
    industry_raw: r.company_industry || null,
  }));
}
