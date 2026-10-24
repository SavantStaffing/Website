/**
 * The services a talent can work through with Savant, and the steps inside
 * each. Keys are stored in public.engagement_steps (its CHECK constraint lists
 * the same pairs), so change both together.
 */
export const ENGAGEMENT_SERVICES = [
  {
    key: "intro",
    label: "Intro / Consultation",
    steps: [
      { key: "meeting", label: "Intro Meeting" },
      { key: "questionnaire", label: "Questionnaire" },
      { key: "initiation", label: "Program Initiation" },
    ],
  },
  {
    key: "resume",
    label: "Resume Building",
    steps: [
      { key: "upload", label: "Upload" },
      { key: "template", label: "Template" },
      { key: "refine", label: "Refine" },
    ],
  },
  {
    key: "interview",
    label: "Interview Practice",
    steps: [
      { key: "session_1", label: "Session 1" },
      { key: "session_2", label: "Session 2" },
      { key: "additional", label: "Additional Sessions" },
    ],
  },
  {
    key: "scout",
    label: "Job Scout",
    steps: [
      { key: "preferences", label: "Preferences" },
      { key: "listings", label: "Curated Listings" },
    ],
  },
] as const;

export type EngagementService = (typeof ENGAGEMENT_SERVICES)[number];
export type ServiceKey = EngagementService["key"];

/** "service:step", the key used to look a step up. */
export const stepId = (service: string, step: string) => `${service}:${step}`;
