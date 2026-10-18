/**
 * Savant's help content: the FAQ page, each hub's Help page and the help
 * assistant all read from here, so they never disagree. Edit answers here.
 *
 * Facts must match the site. Prices and policies the assistant may state are
 * only the ones written here; anything else it refers to the Savant team.
 */

export type HelpRole = "talent" | "recruiter" | "coach";

export type Faq = {
  q: string;
  a: string;
  links?: { label: string; to: string }[];
};

export const ROLE_LABEL: Record<HelpRole, string> = {
  talent: "Talent",
  recruiter: "Recruiters",
  coach: "Career coaches",
};

export const CONTACT_EMAIL = "info@savantalent.com";

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export const FAQ: Record<HelpRole, Faq[]> = {
  talent: [
    {
      q: "How do I apply for jobs?",
      a: "Open your Job Feed, use the filters (role, location, pay, temp & hourly or professional) and click Apply on a role. Jobs posted by Savant's clients are submitted to the employer straight away. Jobs from company career sites open the employer's own application, and we add them to your Applications so you can track them. With the free Savant Apply browser extension, applications on Greenhouse, Lever, Ashby and Workday fill themselves in from your profile; you review and submit. Temp and hourly shifts from our partner apps (Instawork, WorkWhile, Bluecrew) are booked in that partner's app.",
      links: [
        { label: "Job Feed", to: "/talent/jobs" },
        { label: "Savant Apply", to: "/autofill" },
      ],
    },
    {
      q: "How is Savant different from Indeed or other job sites?",
      a: "Three ways. Broader range: alongside professional roles we include temp and hourly work, with instant-hire shifts through our partner apps. We filter: listings come with a Savant employer rating for fair pay, how companies treat their people and their labor record, and we screen out stale and suspected ghost listings. Career development: Savant career coaches help with your résumé, interview practice, job fairs and career programs, one-on-one.",
      links: [{ label: "Employer Ratings", to: "/employer-ratings" }],
    },
    {
      q: "How do I check my applications?",
      a: "Go to Applications in your hub. Each application shows its status: Started on company site, Submitted, Reviewed, Interviewing, Hired or Not selected. For jobs on a company's own site, Continue reopens the application. You can withdraw an application that's Started or Submitted. Interview times and messages from recruiters also arrive in your Inbox and Calendar.",
      links: [{ label: "Applications", to: "/talent/applications" }],
    },
    {
      q: "How much does Savant cost?",
      a: "Nothing. Savant is free for talent, including the job feed, employer ratings, Savant Apply and career coaching through Savant.",
    },
    {
      q: "How do the employer ratings work?",
      a: "Each employer gets a Savant Employer Rating from 0 to 100 and a tier: Exemplary (80–100), Strong (65–79), Fair (50–64), Mixed (35–49) or Concerning (0–34). It combines independent sources: fair pay and worker respect, respect for cultures and communities, and honest business (World Benchmarking Alliance), overall corporate conduct (JUST Capital), and diversity, equity and inclusion (As You Sow). Points are taken off for U.S. Department of Labor wage-and-hour and safety violations at Bay Area sites in the last five years. Missing sources are left out rather than counted as zero, and a confidence label shows how much data backs the score. Hover over or tap a score on the site to see its breakdown.",
      links: [{ label: "Employer Ratings", to: "/employer-ratings" }],
    },
    {
      q: "What is an ATS?",
      a: "An applicant tracking system: the software most employers use to receive and screen applications, such as Greenhouse, Lever, Ashby and Workday. Many ATSs scan résumés for structure and keywords before a person reads them, so a clear, standard layout matters. Savant's Resume Building service uses Yale University's résumé template, structured to pass ATS screening, and Savant Apply fills in ATS application forms for you.",
      links: [{ label: "Career services", to: "/preparation" }],
    },
    {
      q: "How do I get a career coach?",
      a: "Request a coach from Career Services. Coaches work with you one-on-one on your résumé, interview practice and job fairs, and a coach is required for every career program. You can also message a coach directly from Chat.",
      links: [
        { label: "Request a coach", to: "/preparation#career-programs" },
        { label: "Chat", to: "/talent/chat" },
      ],
    },
    {
      q: "Who can see my profile?",
      a: "Recruiters on Savant can find your profile in their Talent Feed, and Savant career coaches can read your résumé, while “Visible to recruiters and coaches” is on in your profile; turn it off any time. Your email and phone stay private until you accept a recruiter's invitation. Coaches and recruiters assigned to you by Savant's team can see your full profile, contact details and résumé.",
      links: [{ label: "Talent Profile", to: "/talent/profile" }],
    },
  ],

  recruiter: [
    {
      q: "How do I find talent?",
      a: "Use the Talent Feed to search people who've made their profile visible to recruiters, by skills, title, name or location. Save anyone you want to come back to under Saved Talent. Assigned Talent lists people Savant's team has matched to you, with their résumé and contact details.",
      links: [
        { label: "Talent Feed", to: "/recruiter/talent" },
        { label: "Assigned Talent", to: "/recruiter/assigned" },
      ],
    },
    {
      q: "How do I send an application request?",
      a: "On a talent card in the Talent Feed, click Request application, choose one of your open roles and click Send invitation. The talent is notified in their Inbox. Their email and phone are shared with you once they accept. Talent & Schedule tracks the invitations you've sent and the replies. You need at least one open job posted to send a request.",
      links: [
        { label: "Talent Feed", to: "/recruiter/talent" },
        { label: "Post a job", to: "/recruiter/jobs" },
      ],
    },
    {
      q: "How do I schedule an interview?",
      a: "In Applications, move the candidate to Interviewing. On Talent & Schedule, set a date and time for anyone marked Interviewing, or schedule an interview directly. Put the Zoom or Google Meet link, or the address, in the note. The candidate is notified with the time, and the interview appears on both of your Calendars.",
      links: [
        { label: "Applications", to: "/recruiter/applications" },
        { label: "Talent & Schedule", to: "/recruiter/schedule" },
        { label: "Calendar", to: "/recruiter/calendar" },
      ],
    },
    {
      q: "How much does Savant cost for recruiters?",
      a: "$10 a month after a one-month free trial.",
    },
    {
      q: "How do I post a job?",
      a: "Go to Jobs and click Post a job. Add the role, location, pay and type. It appears in Savant's job feed for talent, and applications arrive under Applications. Set up your company details first so postings carry your company's name.",
      links: [
        { label: "Jobs", to: "/recruiter/jobs" },
        { label: "Company", to: "/recruiter/company" },
      ],
    },
    {
      q: "How do I request résumés or documents?",
      a: "Message the candidate in Chat. They can reply with files attached: PDF, Word, Excel, text or images, up to 10 MB each, visible only to the two of you. Résumés of talent assigned to you are already on Assigned Talent. Don't collect Social Security numbers, bank details or ID scans in chat; use your company's secure onboarding system for those.",
      links: [{ label: "Chat", to: "/recruiter/chat" }],
    },
    {
      q: "Who can I message?",
      a: "Talent who are visible to recruiters, and talent assigned to you. Talent can reply once you've written first. Savant's team can message you at any time, and you can reply.",
      links: [{ label: "Chat", to: "/recruiter/chat" }],
    },
    {
      q: "Why can't I see recruiter pages yet?",
      a: "New recruiter accounts are reviewed by Savant's team before they can post jobs or search talent. You'll get an Inbox message when you're approved.",
    },
  ],

  coach: [
    {
      q: "How do I choose who to coach?",
      a: "Align your skill set with their career goals. On Talent, under Find talent to coach, look at each person's headline, experience, skills and goals, choose people whose direction matches what you're strongest at, and click Request to coach. Savant's team approves the match, and they then appear under Your talent.",
      links: [{ label: "Talent", to: "/coach/talent" }],
    },
    {
      q: "How does coaching through Savant work?",
      a: "1. Get talent: Savant's team assigns you service requests, or you request talent yourself. 2. Schedule an intro meeting on Zoom or Google Meet, covering a questionnaire about their background and goals, their career trajectory, and optimizing their Savant profile. 3. Set up the work they signed up for: Resume Building (Yale University template, structured for applicant tracking systems), Interview Development, Job Fairs or a career program. 4. Schedule each session on Schedule; they're notified and it appears on both Calendars. 5. Keep in touch in Chat, exchange résumé drafts as attachments, and send them suitable jobs with Send to talent. Track each request on Service Requests and mark it completed when done.",
      links: [
        { label: "Service Requests", to: "/coach" },
        { label: "Schedule", to: "/coach/schedule" },
      ],
    },
    {
      q: "What is the pay?",
      a: "It depends on the arrangement: either set by the third-party employer partner the coaching is for, or by a contract you negotiate personally with Savant. Talk to the Savant team about your arrangement.",
    },
    {
      q: "How do I schedule a session?",
      a: "Open Schedule, pick the person and set a date and time. Put the Zoom or Google Meet link in the note. The talent is notified, and the session appears on both of your Calendars (at the bottom of Schedule). You can add the Calendar feed to Google, Outlook or Apple Calendar.",
      links: [{ label: "Schedule", to: "/coach/schedule" }],
    },
    {
      q: "How do I ask a talent to meet?",
      a: "On Talent, open the person under Your talent and click Request intro meeting, or Request meeting for anything else (describe what it's about). Offer three times and a length. They pick one from their dashboard, or tell you none work, and you're notified either way. Confirmed meetings appear on both Calendars. Track and cancel requests on Schedule.",
      links: [
        { label: "Talent", to: "/coach/talent" },
        { label: "Schedule", to: "/coach/schedule" },
      ],
    },
    {
      q: "Who can I message?",
      a: "Any talent on Savant. Recruiters and other coaches aren't reachable from Chat. Savant's team can message you at any time.",
      links: [{ label: "Chat", to: "/coach/chat" }],
    },
    {
      q: "How do I send a job to someone I'm coaching?",
      a: "Open a job from Jobs and click Send to talent, then choose people you're coaching. It arrives in their Inbox.",
      links: [{ label: "Jobs", to: "/jobs" }],
    },
  ],
};

// ---------------------------------------------------------------------------
// Pages in each hub (what the assistant may point people to)
// ---------------------------------------------------------------------------

export const PAGES: Record<HelpRole, { label: string; to: string; what: string }[]> = {
  talent: [
    {
      label: "Dashboard",
      to: "/talent",
      what: "overview of applications, saved jobs and coaching",
    },
    {
      label: "Inbox",
      to: "/talent/inbox",
      what: "notifications: invitations, interviews, messages",
    },
    {
      label: "Chat",
      to: "/talent/chat",
      what: "messages with coaches, recruiters and Savant's team",
    },
    {
      label: "Calendar",
      to: "/talent/calendar",
      what: "interviews and coaching sessions; sync to your own calendar",
    },
    { label: "Job Feed", to: "/talent/jobs", what: "personalised jobs with filters" },
    {
      label: "Intake",
      to: "/talent/intake",
      what: 'your introduction to Savant: industry, role, ZIP code, travel distance and weekly availability. The job feed opens refined to these answers ("Show all jobs" widens it), and your coach and Savant admins can see them',
    },
    { label: "Temporary Work", to: "/talent/temporary-work", what: "temp and hourly shifts" },
    { label: "Applications", to: "/talent/applications", what: "status of each application" },
    {
      label: "Talent Profile",
      to: "/talent/profile",
      what: "résumé, details, recruiter visibility",
    },
    { label: "Preferences", to: "/talent/preferences", what: "what jobs you want to see" },
    {
      label: "Settings",
      to: "/talent/settings",
      what: "account, email notifications, delete account",
    },
    {
      label: "Career services",
      to: "/preparation",
      what: "request a coach, résumé building, interview development, job fairs",
    },
    {
      label: "Savant Apply",
      to: "/autofill",
      what: "browser extension that fills in applications",
    },
  ],
  recruiter: [
    { label: "Dashboard", to: "/recruiter", what: "your company's listings and hires" },
    { label: "Getting started", to: "/recruiter/welcome", what: "step-by-step guide" },
    { label: "Inbox", to: "/recruiter/inbox", what: "notifications" },
    {
      label: "Chat",
      to: "/recruiter/chat",
      what: "messages with talent and Savant's team; file attachments",
    },
    { label: "Calendar", to: "/recruiter/calendar", what: "interviews; sync to your own calendar" },
    {
      label: "Talent & Schedule",
      to: "/recruiter/schedule",
      what: "schedule interviews, track invitations",
    },
    {
      label: "Talent Feed",
      to: "/recruiter/talent",
      what: "search visible talent, save, request applications",
    },
    {
      label: "Assigned Talent",
      to: "/recruiter/assigned",
      what: "talent matched to you, with résumés",
    },
    { label: "Saved Talent", to: "/recruiter/saved", what: "people you saved" },
    { label: "Jobs", to: "/recruiter/jobs", what: "post jobs and see your postings" },
    { label: "Applications", to: "/recruiter/applications", what: "applicants and their status" },
    { label: "Company", to: "/recruiter/company", what: "company details" },
    { label: "Account", to: "/recruiter/account", what: "your account" },
  ],
  coach: [
    { label: "Getting started", to: "/coach/welcome", what: "step-by-step guide" },
    { label: "Service Requests", to: "/coach", what: "coaching requests assigned to you" },
    { label: "Inbox", to: "/coach/inbox", what: "notifications" },
    {
      label: "Chat",
      to: "/coach/chat",
      what: "messages with talent and Savant's team; file attachments",
    },
    {
      label: "Schedule",
      to: "/coach/schedule",
      what: "schedule sessions, meeting requests, and your calendar with sync",
    },
    {
      label: "Talent",
      to: "/coach/talent",
      what: "your talent (request intro or general meetings), and find talent to coach",
    },
    {
      label: "Recruiters",
      to: "/coach/recruiters",
      what: "recruiters and companies hiring on Savant",
    },
    { label: "Jobs", to: "/jobs", what: "job listings; send a job to talent" },
    { label: "Settings", to: "/coach/settings", what: "your account" },
  ],
};

// ---------------------------------------------------------------------------
// Ground rules every answer follows
// ---------------------------------------------------------------------------

export const POLICIES = [
  "Savant never submits a job application for you; you review and submit.",
  "Talent's email and phone stay private until they accept a recruiter's invitation.",
  "Chat attachments are visible only to the two people in the conversation.",
  "Never share Social Security numbers, bank details, passwords or ID scans in Chat.",
  "Interview and session times on Savant are shown in Pacific time in notifications.",
  `For anything not covered here, contact the Savant team at ${CONTACT_EMAIL} or through the Contact page.`,
  "Accounts can be deleted at any time from Settings; the Privacy Policy and Terms of Use are at /privacy and /terms.",
];

/** Everything the assistant knows for one role, as plain text for the model. */
export function knowledgeFor(role: HelpRole): string {
  const faq = FAQ[role].map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
  const pages = PAGES[role].map((p) => `- ${p.label} (${p.to}): ${p.what}`).join("\n");
  const rules = POLICIES.map((p) => `- ${p}`).join("\n");
  return [
    `SAVANT\nSavant (savantalent.com) is a staffing and careers platform: a job feed with professional and temp/hourly roles, independent employer ratings, the Savant Apply autofill extension, and one-on-one career coaching. Account types: talent (job seekers), recruiters (employers), career coaches and Savant admins.`,
    `THIS PERSON IS A ${ROLE_LABEL[role].toUpperCase().replace(/S$/, "")}.`,
    `FAQ\n${faq}`,
    `PAGES IN THEIR HUB\n${pages}`,
    `RULES\n${rules}`,
  ].join("\n\n");
}
