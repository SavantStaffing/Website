import type { Database } from "@/integrations/supabase/types";

/** Rows behind the two feeds on /careers. */
export type CareerProgram = Database["public"]["Tables"]["career_programs"]["Row"];
export type CareerEvent = Database["public"]["Tables"]["career_events"]["Row"];

export const PROGRAM_TYPE_LABEL: Record<string, string> = {
  training: "Training",
  apprenticeship: "Apprenticeship",
  certification: "Certification",
  bootcamp: "Bootcamp",
  internship: "Internship",
  fellowship: "Fellowship",
  other: "Program",
};

export const EVENT_TYPE_LABEL: Record<string, string> = {
  job_fair: "Job fair",
  networking: "Networking",
  workshop: "Workshop",
  info_session: "Info session",
  conference: "Conference",
  other: "Event",
};

/** Shown for rows that haven't been given an industry. */
export const NO_INDUSTRY = "General";

/** Industries present in a feed, A–Z, with "General" last. */
export function industriesOf(rows: { industry: string | null }[]): string[] {
  const names = [...new Set(rows.map((r) => r.industry ?? NO_INDUSTRY))];
  return names.sort((a, b) =>
    a === NO_INDUSTRY ? 1 : b === NO_INDUSTRY ? -1 : a.localeCompare(b),
  );
}

/** Group a feed by industry, keeping each group's rows in feed order. */
export function byIndustry<T extends { industry: string | null }>(rows: T[]): [string, T[]][] {
  return industriesOf(rows).map((name) => [
    name,
    rows.filter((r) => (r.industry ?? NO_INDUSTRY) === name),
  ]);
}
