/**
 * Deterministic mapping from application-form fields to the talent profile.
 * Ported from the Autofill prototype (mapper.py / models.py / detect.py).
 * Order: ATS field-name map → label rules → saved answers → (LLM draft, drafter.server.ts).
 */

export type FieldType = "text" | "textarea" | "file" | "select" | "multiselect" | "checkbox";
export type FillSource = "profile" | "saved_answer" | "llm_draft" | "skipped" | "none";

export type Option = { label: string; value: string };

export type FormField = {
  key: string; // name or id on the live form, e.g. "first_name", "question_123", "urls[LinkedIn]"
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Option[];
  section?: "standard" | "custom" | "eeo";
};

export type Fill = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  value: string | boolean | string[] | null;
  source: FillSource;
  needs_review: boolean;
  section: string;
  filename?: string | null;
};

export type FillPlan = {
  ats: string;
  job_url: string;
  fills: Fill[];
  unresolved_required: string[];
};

export type AutofillProfile = Record<string, string | boolean | null | undefined>;

// ---------------------------------------------------------------- detect
const JOB_PATTERNS: [string, RegExp][] = [
  ["greenhouse", /(?:boards|job-boards)\.greenhouse\.io\/([\w-]+)\/jobs\/(\d+)/],
  ["lever", /jobs\.lever\.co\/([\w.-]+)\/([0-9a-f-]{36})/],
  ["ashby", /jobs\.ashbyhq\.com\/([\w.%-]+)\/([0-9a-f-]{36})/],
];

/** (ats, company_token, job_id) for a specific job posting URL, or null. */
export function detectJob(url: string): { ats: string; token: string; jobId: string } | null {
  for (const [ats, rx] of JOB_PATTERNS) {
    const m = rx.exec(url);
    if (m) return { ats, token: m[1], jobId: m[2] };
  }
  return null;
}

// ---------------------------------------------------------------- mapping
const KEY_MAP: Record<string, Record<string, string>> = {
  greenhouse: {
    first_name: "first_name",
    last_name: "last_name",
    email: "email",
    phone: "phone",
    resume: "resume_path",
  },
  lever: {
    name: "full_name",
    email: "email",
    phone: "phone",
    org: "current_company",
    location: "location",
    resume: "resume_path",
    "urls[LinkedIn]": "linkedin_url",
    "urls[GitHub]": "github_url",
    "urls[Portfolio]": "portfolio_url",
  },
};

// First match wins, so specific patterns go before general ones.
const LABEL_RULES: [RegExp, string | null][] = [
  [/linkedin/i, "linkedin_url"],
  [/github/i, "github_url"],
  [/portfolio|personal (web)?site/i, "portfolio_url"],
  [/preferred first name/i, null],
  [/first name/i, "first_name"],
  [/last name|surname|family name/i, "last_name"],
  [/full name|^name$/i, "full_name"],
  [/e-?mail address|^e-?mail$/i, "email"],
  [/phone|mobile/i, "phone"],
  [/current (company|employer)/i, "current_company"],
  [/current (job )?(title|role)/i, "current_title"],
  [/\b(current )?location\b|\bcity\b/i, "location"],
  [/sponsor/i, "needs_sponsorship"],
  [/authori[sz]ed to work|eligible to work/i, "work_authorized"],
  [/salary|compensation expectation|desired pay/i, "salary_expectation"],
  [/start date|when can you start|notice period/i, "earliest_start"],
];

const TEXT_ATTRS = new Set([
  "first_name",
  "last_name",
  "full_name",
  "email",
  "phone",
  "linkedin_url",
  "github_url",
  "portfolio_url",
  "current_company",
  "current_title",
  "location",
]);
const REVIEW_ATTRS = new Set([
  "needs_sponsorship",
  "work_authorized",
  "salary_expectation",
  "earliest_start",
]);
export const EEO_RE =
  /gender|race|ethnic|hispanic|latin|veteran|disabilit|sexual orientation|pronoun/i;
const SKIP_KEYS = new Set(["resume_text", "cover_letter_text"]);

export function norm(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ruleAttr(label: string): string | null {
  for (const [rx, attr] of LABEL_RULES) if (rx.test(label)) return attr;
  return null;
}

/** Turn a profile value into what this field accepts, or null if no option fits. */
function coerce(field: FormField, value: unknown): Fill["value"] {
  const want =
    typeof value === "boolean" ? (value ? "yes" : "no") : String(value).trim().toLowerCase();
  if (field.type === "checkbox") return want === "yes" || want === "true";
  if (field.type === "select" || field.type === "multiselect") {
    const options = field.options ?? [];
    // Custom combobox: options only exist once opened, so pass the label text.
    if (options.length === 0)
      return ({ yes: "Yes", no: "No" } as Record<string, string>)[want] ?? String(value);
    const exact = options.find((o) => o.label.trim().toLowerCase() === want);
    if (exact) return exact.value;
    const prefix = options.find((o) => o.label.trim().toLowerCase().startsWith(want));
    return prefix ? prefix.value : null;
  }
  return String(value);
}

export function buildPlan(
  ats: string,
  fields: FormField[],
  profile: AutofillProfile,
  saved: Record<string, string>,
): Fill[] {
  const p: AutofillProfile = { ...profile };
  p.full_name = [p.first_name, p.last_name].filter(Boolean).join(" ") || null;

  return fields.map((f): Fill => {
    const base = {
      key: f.key,
      label: f.label,
      type: f.type,
      required: !!f.required,
      value: null,
      source: "none" as FillSource,
      needs_review: true,
      section: f.section ?? "custom",
    };

    // Demographic / EEO questions are always the candidate's own choice.
    if (f.section === "eeo" || EEO_RE.test(f.label)) return { ...base, section: "eeo" };
    if (SKIP_KEYS.has(f.key)) return { ...base, source: "skipped", needs_review: false };

    let attr: string | null = KEY_MAP[ats]?.[f.key] ?? ruleAttr(f.label);
    if (f.type === "file") attr = /resume|cv/i.test(`${f.key} ${f.label}`) ? "resume_path" : null;
    else if (attr && TEXT_ATTRS.has(attr) && f.type !== "text" && f.type !== "textarea")
      attr = null;

    const pv = attr ? p[attr] : null;
    if (attr && pv !== null && pv !== undefined && pv !== "") {
      const val = f.type === "file" ? String(pv) : coerce(f, pv);
      if (val !== null) {
        return {
          ...base,
          value: val,
          source: "profile",
          needs_review: REVIEW_ATTRS.has(attr),
          filename:
            f.type === "file"
              ? String(p.resume_filename ?? "") ||
                String(pv).split("?")[0].split("/").pop() ||
                "resume.pdf"
              : null,
        };
      }
    }

    const ans = saved[norm(f.label)];
    if (ans !== undefined) {
      const val = coerce(f, ans);
      if (val !== null) return { ...base, value: val, source: "saved_answer", needs_review: false };
    }

    return base; // unresolved; open textareas may get an LLM draft next
  });
}
