/**
 * Career Programs subsections. Each has an in-depth page at
 * /preparation/career-programs/<slug>. Fill in the detail fields as content
 * is ready; empty ones show "Details coming soon".
 */
export type CareerProgram = {
  slug: string;
  name: string;
  tag: string;
  /** Opening paragraph on the program's page. */
  overview: string;
  whoItsFor: string[];
  whatYouGet: string[];
  howItWorks: string[];
};

export const CAREER_PROGRAMS: CareerProgram[] = [
  {
    slug: "apprenticeship",
    name: "Apprenticeship Program",
    tag: "Entry-level talent, trained on the job",
    overview: "",
    whoItsFor: [],
    whatYouGet: [],
    howItWorks: [],
  },
  {
    slug: "training-certification",
    name: "Training & Certification",
    tag: "Upskilling for in-demand roles",
    overview: "",
    whoItsFor: [],
    whatYouGet: [],
    howItWorks: [],
  },
  {
    slug: "scholarships",
    name: "Scholarship Opportunities",
    tag: "Funding for training and education",
    overview: "",
    whoItsFor: [],
    whatYouGet: [],
    howItWorks: [],
  },
  {
    slug: "internships",
    name: "Internships",
    tag: "Real work experience with Savant clients",
    overview: "",
    whoItsFor: [],
    whatYouGet: [],
    howItWorks: [],
  },
];

/** The Preparation services talent can sign up for (public.service_requests.service). */
export const SERVICES = [
  {
    id: "career_programs",
    anchor: "career-programs",
    title: "Career Programs",
    intro: "Structured programs that get you trained and placed. Content coming soon.",
    items: CAREER_PROGRAMS,
  },
  {
    id: "resume_building",
    anchor: "resume-building",
    title: "Resume Building",
    intro:
      "Work one-on-one with a Savant career coach on a resume that gets read. Content coming soon.",
    items: [] as CareerProgram[],
  },
  {
    id: "interview_development",
    anchor: "interview-development",
    title: "Interview Development",
    intro: "Practice interviews and feedback from a Savant career coach. Content coming soon.",
    items: [] as CareerProgram[],
  },
  {
    id: "job_fairs",
    anchor: "job-fairs",
    title: "Job Fairs",
    intro:
      "Meet employers face to face at job fairs and hiring events with Savant. Content coming soon.",
    items: [] as CareerProgram[],
  },
] as const;

export type ServiceId = (typeof SERVICES)[number]["id"];

export const SERVICE_LABEL = Object.fromEntries(SERVICES.map((s) => [s.id, s.title])) as Record<
  ServiceId,
  string
>;

export const SERVICE_STATUS_LABEL: Record<string, string> = {
  new: "Requested",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};
