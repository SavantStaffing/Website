/** Display labels for job_applications.status, shared by talent and recruiter views. */
export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  tracked: "Added by link",
  started: "Started on company site",
  submitted: "Submitted",
  reviewed: "Reviewed",
  interviewing: "Interviewing",
  hired: "Hired",
  rejected: "Not selected",
};

/** Statuses a recruiter can move an application through. */
export const RECRUITER_STATUSES = [
  "submitted",
  "reviewed",
  "interviewing",
  "hired",
  "rejected",
] as const;

/** What the talent sees: once they've finished applying, it's simply "Completed". */
export const TALENT_STATUS_LABEL: Record<string, string> = {
  ...APPLICATION_STATUS_LABEL,
  submitted: "Completed",
};

/** A row on the talent's Applications page (see APPLICATION_SELECT). */
export type TalentApplication = {
  id: string;
  status: string;
  created_at: string;
  archived_at: string | null;
  external_url: string | null;
  external_title: string | null;
  external_company: string | null;
  external_location: string | null;
  jobs: {
    title: string;
    company_name: string | null;
    location: string | null;
    type: string | null;
    apply_url: string | null;
  } | null;
};

export const APPLICATION_SELECT =
  "id, status, created_at, archived_at, external_url, external_title, external_company, external_location, jobs (title, company_name, location, type, apply_url)";
