/**
 * Temporary-staffing partner platforms, and what's available on them.
 *
 * This is the one file to edit when the position data changes. Fill in
 * `positions` per partner; the pages at /temporary-staffing (informative)
 * and /talent/temporary-work (with sign-up links) render from it.
 *
 * To add a logo: put the file in src/assets/partners/ and import it below,
 * e.g. `import bluecrewLogo from "@/assets/partners/bluecrew.svg";` then set
 * `logo: bluecrewLogo`. Without one, the partner's name is shown instead.
 */

export type ActivityLevel = "high" | "medium" | "low";

export type PartnerPosition = {
  /** Position type, e.g. "Warehouse Associate". */
  title: string;
  /** Companies actively hiring for it on this platform. */
  companies: string[];
  /** How often shifts for this position come up. */
  activity: ActivityLevel;
  /** Hourly pay range in USD. */
  payMin: number;
  payMax: number;
};

export type TempPartner = {
  id: "bluecrew" | "workwhile" | "instawork";
  name: string;
  logo?: string;
  /** One line on what the platform is. */
  tagline: string;
  /** Key facts on how it operates (employment type, pay timing, onboarding…). */
  howItWorks: string[];
  /** Where talent create their worker account. */
  signupUrl: string;
  positions: PartnerPosition[];
};

/** When the position data below was last gathered (YYYY-MM-DD), shown on the page. */
export const TEMP_DATA_AS_OF: string | null = null;

export const TEMP_PARTNERS: TempPartner[] = [
  {
    id: "bluecrew",
    name: "Bluecrew",
    tagline: "Flexible hourly work, now part of Employbridge.",
    howItWorks: [],
    signupUrl: "https://www.bluecrewjobs.com/",
    positions: [],
  },
  {
    id: "workwhile",
    name: "WorkWhile",
    tagline: "Hourly shifts matched to your skills and schedule.",
    howItWorks: [],
    signupUrl: "https://www.workwhile.ai/for-workers",
    positions: [],
  },
  {
    id: "instawork",
    name: "Instawork",
    tagline: "Pick up shifts at local businesses on your own schedule.",
    howItWorks: [],
    signupUrl: "https://www.instawork.com/worker",
    positions: [],
  },
];

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  high: "High activity",
  medium: "Moderate activity",
  low: "Occasional",
};
