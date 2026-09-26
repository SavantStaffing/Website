/** Display labels for job_applications.status, shared by talent and recruiter views. */
export const APPLICATION_STATUS_LABEL: Record<string, string> = {
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
