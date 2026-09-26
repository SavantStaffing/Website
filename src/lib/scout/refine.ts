import { EMPLOYMENT_TYPE_LABELS, type EmploymentType, type Seniority } from "./types.ts";

/**
 * "Refine parameters": turn each source's free-text fields into the fixed
 * vocabulary the feed filters on — position, industry / NAICS, date posted,
 * location, and full / part time / temporary.
 */

export function normalizeEmploymentType(
  raw: string | null | undefined,
  title = "",
): EmploymentType | null {
  const s = `${raw ?? ""}`.toLowerCase().replace(/[^a-z]/g, "");
  if (/intern/.test(s)) return "internship";
  if (/parttime|halftime/.test(s)) return "part_time";
  if (/temp|seasonal|fixedterm/.test(s)) return "temporary";
  if (/contract|freelance|consultant|c2h|contracttohire/.test(s)) return "contract";
  if (/fulltime|permanent|regular/.test(s)) return "full_time";
  // No usable field: fall back to what the title says.
  const t = title.toLowerCase();
  if (/\bintern(ship)?\b/.test(t)) return "internship";
  if (/\bpart[- ]time\b/.test(t)) return "part_time";
  if (/\b(temp|temporary|seasonal)\b/.test(t)) return "temporary";
  if (/\b(contract|contractor|freelance)\b/.test(t)) return "contract";
  return null;
}

export function employmentTypeLabel(t: string | null | undefined): string | null {
  return t && t in EMPLOYMENT_TYPE_LABELS ? EMPLOYMENT_TYPE_LABELS[t as EmploymentType] : null;
}

export function inferSeniority(title: string): Seniority {
  const t = title.toLowerCase();
  if (/\bintern(ship)?\b/.test(t)) return "intern";
  if (/\b(chief|c[etofi]o|vp|vice president|head of|director)\b/.test(t)) return "executive";
  if (/\b(lead|principal|staff|manager|architect)\b/.test(t)) return "lead";
  if (/\b(senior|sr\.?|iii|iv)\b/.test(t)) return "senior";
  if (/\b(junior|jr\.?|entry|associate|graduate|new grad|trainee|apprentice|i)\b/.test(t))
    return "entry";
  return "mid";
}

export function isRemote(location: string | null, hint: boolean | null): boolean {
  if (hint !== null) return hint;
  return /\b(remote|anywhere|distributed|work from home|wfh)\b/i.test(location ?? "");
}

/** Clean display title: drop requisition numbers and trailing location/tags in brackets. */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[([]\s*(req|job|id|#)[^)\]]*[)\]]/gi, "")
    .replace(/\s*[-–|]\s*(req|job id)\s*#?\s*[\w-]+$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Stable key for "same job, different posting" — used for repost detection. */
export function fingerprint(company: string, title: string, location: string | null): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${norm(company)}|${norm(cleanTitle(title))}|${norm(location ?? "")}`;
}

/**
 * Coarse NAICS sector from an industry label, for sources (SmartRecruiters,
 * Workable, JobSpy) that give an industry but no code. Company-level NAICS
 * from the admin config always wins over this.
 */
const NAICS_SECTORS: [RegExp, string, string][] = [
  [
    /software|internet|information tech|saas|computer|it services|telecom|media|publishing/i,
    "51",
    "Information",
  ],
  [/bank|financ|insurance|invest|capital|fintech|credit/i, "52", "Finance and Insurance"],
  [/real estate|property|leasing/i, "53", "Real Estate"],
  [
    /consult|legal|law|accounting|engineering services|design|marketing|advertising|research/i,
    "54",
    "Professional, Scientific, and Technical Services",
  ],
  [
    /staffing|recruit|employment|outsourc|facilities|security services/i,
    "56",
    "Administrative and Support Services",
  ],
  [/educat|school|university|training|e-?learning/i, "61", "Educational Services"],
  [
    /health|hospital|medical|clinic|pharma|biotech|care/i,
    "62",
    "Health Care and Social Assistance",
  ],
  [/entertain|recreation|gaming|sports|arts/i, "71", "Arts, Entertainment, and Recreation"],
  [/hospitality|restaurant|hotel|food service|travel/i, "72", "Accommodation and Food Services"],
  [/retail|e-?commerce|consumer goods|apparel/i, "44", "Retail Trade"],
  [/wholesale|distribution/i, "42", "Wholesale Trade"],
  [
    /manufactur|industrial|automotive|aerospace|semiconductor|hardware|electronics/i,
    "31",
    "Manufacturing",
  ],
  [/construct|building/i, "23", "Construction"],
  [
    /transport|logistics|shipping|trucking|airline|supply chain/i,
    "48",
    "Transportation and Warehousing",
  ],
  [/energy|utilit|oil|gas|solar|power/i, "22", "Utilities"],
  [/government|public sector|defense|federal/i, "92", "Public Administration"],
  [/non-?profit|charity|foundation/i, "81", "Other Services"],
  [/agricultur|farm|forestry|fishing/i, "11", "Agriculture"],
];

export function naicsFromIndustry(
  industry: string | null | undefined,
): { code: string; label: string } | null {
  if (!industry) return null;
  for (const [rx, code, label] of NAICS_SECTORS) if (rx.test(industry)) return { code, label };
  return null;
}

export const NAICS_SECTOR_OPTIONS = NAICS_SECTORS.map(([, code, label]) => ({ code, label })).sort(
  (a, b) => a.code.localeCompare(b.code),
);
