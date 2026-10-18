import type { Inline, JournalEntry } from "./types";

const BLS = "https://www.bls.gov/ooh";

export const ENTRIES: JournalEntry[] = [
  {
    slug: "high-pay-low-barrier",
    title: "High pay, low barrier: Bay Area careers you can start in two years or less",
    date: "2026-10-15",
    category: "Career paths",
    summary:
      "Three paths (imaging, HVAC/R and medical coding) can reach a Bay Area paycheck of $75,000 or more for $3,500 or less. Here is how they compare, what to verify first, and how to pay for training.",
    blocks: [
      { type: "h2", text: "The short answer" },
      {
        type: "p",
        content: [
          "You don't need a four-year degree or a large tuition bill to reach a Bay Area paycheck of $75,000 or more. Three paths in our research stand out: imaging (radiologic technology and sonography), HVAC/R, and medical coding. Each costs $3,500 or less, takes two years or less, and matches what employers say they expect, according to the U.S. Bureau of Labor Statistics (BLS).",
        ],
      },
      {
        type: "p",
        content: [
          "Other paths pay well too, but come with a catch. Some are cheap and fast, yet we couldn't confirm what employers ask for. Others pay well because the job usually calls for a degree. We sort them out below so you can choose with your eyes open.",
        ],
      },

      { type: "h2", text: "At a glance" },
      {
        type: "p",
        content: [
          "Bay Area pay ranges come from our own research and sit above the U.S. median for every job where BLS has a match, so check current postings before you plan around them.",
        ],
      },
      {
        type: "table",
        head: [
          "Job",
          "Training",
          "Time",
          "Cost",
          "Bay Area pay range",
          "U.S. median pay (BLS, May 2025)",
        ],
        rows: [
          [
            [
              {
                text: "Diagnostic medical sonographer",
                href: `${BLS}/healthcare/diagnostic-medical-sonographers.htm`,
              },
            ],
            ["Imaging program at Foothill College or City College of San Francisco (CCSF)"],
            ["23 to 24 months"],
            ["$2,500 to $3,500"],
            ["$160,300 to $173,200"],
            ["$96,590"],
          ],
          [
            [
              {
                text: "Radiologic technologist",
                href: `${BLS}/healthcare/radiologic-technologists.htm`,
              },
            ],
            ["Same imaging program"],
            ["23 to 24 months"],
            ["$2,500 to $3,500"],
            ["$141,800 to $154,900"],
            ["$81,390"],
          ],
          [
            [
              {
                text: "HVAC/R technician",
                href: `${BLS}/installation-maintenance-and-repair/heating-air-conditioning-and-refrigeration-mechanics-and-installers.htm`,
              },
            ],
            ["Laney College or San Jose City College"],
            ["8 to 12 months, or 2 semesters"],
            ["$1,200 to $3,200"],
            ["$78,500 to $82,050"],
            ["$61,010"],
          ],
          [
            [
              {
                text: "Medical coding and health information technician",
                href: `${BLS}/healthcare/medical-records-and-health-information-technicians.htm`,
              },
            ],
            ["CCSF"],
            ["2 to 3 semesters"],
            ["About $1,800"],
            ["$74,400 to $86,900"],
            ["$51,140"],
          ],
          [
            ["Salesforce/CRM administrator"],
            ["Calbright College or Mission College"],
            ["3 to 6 months, or 1 semester"],
            ["Free to about $500"],
            ["$89,400 to $93,600"],
            ["No BLS category"],
          ],
          [
            ["Biomanufacturing technician"],
            ["Laney College"],
            ["1 year"],
            ["About $736"],
            ["$72,900 to $95,200"],
            ["No BLS category"],
          ],
        ],
      },

      { type: "h2", text: "Three paths worth a look" },
      {
        type: "p",
        content: [
          { bold: "Imaging: radiologic technology and sonography." },
          " Foothill College in Los Altos runs a 23-month program for about $3,500, and City College of San Francisco (CCSF) runs a 24-month program for about $2,500. BLS says both jobs typically need an associate's degree, and most states license or certify radiologic technologists. BLS projects 14% growth for sonographers and 5% for radiologic technologists from 2025 to 2035.",
        ],
      },
      {
        type: "p",
        content: [
          { bold: "HVAC/R." },
          " Laney College in Oakland offers an 8 to 12 month program for $2,400 to $3,200, and San Jose City College offers a two-semester program for about $1,200. BLS says most technicians start with a postsecondary certificate, learn on the job beside experienced technicians, and need EPA refrigerant certification. BLS projects 11% growth through 2035. Cypress Mandela's free, 16-week construction pre-apprenticeship is another way into the trades.",
        ],
      },
      {
        type: "p",
        content: [
          { bold: "Medical coding." },
          " CCSF's medical coding and health information technology program takes 2 to 3 semesters and costs about $1,800. BLS lists a postsecondary certificate as the typical way into medical records work, and employers may require or prefer certification. BLS projects 8% growth through 2035.",
        ],
      },

      { type: "h2", text: "Two to verify first" },
      {
        type: "p",
        content: [
          "BLS has no category for these jobs, so we couldn't check what employers expect. Read current postings before you enroll.",
        ],
      },
      {
        type: "p",
        content: [
          { bold: "CRM administration." },
          " Calbright College's CRM Platform Administration program is online, self-paced and free for Californians. It takes under six months at about 6 to 12 hours a week. Mission College in Santa Clara offers a one-semester option for about $500. Our research notes a slight national decline in demand for these roles.",
        ],
      },
      {
        type: "p",
        content: [
          { bold: "Biomanufacturing." },
          " Laney College's one-year biomanufacturing certificate costs about $736 and lists federal aid. Our research describes steady Bay Area biotech and pharma demand. Ask the program where recent graduates work.",
        ],
      },

      { type: "h2", text: "Good pay, bigger ask" },
      {
        type: "p",
        content: ["These jobs pay well, but a short program usually isn't enough on its own."],
      },
      {
        type: "ul",
        items: [
          [
            { bold: "Cybersecurity." },
            " BLS lists a bachelor's degree as typical entry for information security analysts, often with prior IT experience. Ohlone College (6 to 12 months, about $2,300) and Diablo Valley College (2 semesters, about $1,400) offer cybersecurity and network operations programs, but those may not meet that bar alone.",
          ],
          [
            { bold: "Data analytics." },
            " De Anza College's data analytics and business intelligence program runs 2 to 3 semesters for about $1,500. BLS lists a bachelor's degree for data scientists, the closest category.",
          ],
          [
            { bold: "Logistics and purchasing." },
            " Skyline College (2 semesters, about $1,300) and Mission College (2 semesters, about $1,000) offer supply chain programs. BLS lists a bachelor's degree for logisticians and buyers, though some employers hire buyers with a high school diploma.",
          ],
          [
            { bold: "Dental hygiene." },
            " Hygienists need an accredited associate degree, usually about three years, and a state license. A 12-month dental assisting course at College of Alameda (about $1,800) leads to a different, lower-paying job.",
          ],
          [
            { bold: "Paralegal." },
            " San Francisco State's one-year paralegal program costs $9,000, and BLS projects little or no growth in paralegal jobs through 2035.",
          ],
        ],
      },

      { type: "h2", text: "Paying for it" },
      { type: "p", content: ["Several of these paths are free or close to it if you qualify."] },
      {
        type: "ul",
        items: [
          [
            { bold: "Free City at CCSF." },
            " ",
            { text: "Free City", href: "https://ccsf.edu/freecity" },
            " covers enrollment fees of $46 per unit for San Francisco residents, with no income test. It doesn't cover everything: the $27 health fee and some materials fees still apply. In our research it applies to the imaging and medical coding programs at CCSF.",
          ],
          [
            { bold: "Calbright College." },
            " ",
            { text: "Calbright", href: "https://www.calbright.edu/programs/" },
            " lists all of its programs as free for Californians, including CRM Platform Administration.",
          ],
          [
            { bold: "Federal aid." },
            " Our research lists FAFSA for the Laney biomanufacturing certificate, Foothill's imaging program and both HVAC/R programs.",
          ],
          [
            { bold: "Cypress Mandela." },
            " Its construction pre-apprenticeship is free and lasts 16 weeks.",
          ],
        ],
      },

      { type: "h2", text: "Before you enroll" },
      { type: "p", content: ["A few checks save time and money."] },
      {
        type: "ul",
        items: [
          [
            { bold: "Look up the license." },
            " Most states license radiologic technologists, some license sonographers, and EPA certification covers nearly all HVAC technicians. Your state board lists the exact steps.",
          ],
          [
            { bold: "Ask about admission." },
            " Ask each program about prerequisites, application deadlines and start dates.",
          ],
          [
            { bold: "Confirm the price." },
            " Costs here are approximate, so ask the school for the current total, including fees and materials.",
          ],
          [
            { bold: "Read current job postings." },
            " Search the job title in your county and note the pay and what employers ask for.",
          ],
        ],
      },

      { type: "h2", text: "Sources" },
      {
        type: "p",
        content: [
          "BLS pay is the May 2025 national median, and BLS growth is the 2025 to 2035 projection. Bay Area pay, program costs and school details come from our own Bay Area program research.",
        ],
      },
      {
        type: "ul",
        items: [
          [
            "BLS Occupational Outlook Handbook: ",
            {
              text: "radiologic technologists",
              href: `${BLS}/healthcare/radiologic-technologists.htm`,
            },
            ", ",
            {
              text: "diagnostic medical sonographers",
              href: `${BLS}/healthcare/diagnostic-medical-sonographers.htm`,
            },
            ", ",
            { text: "dental hygienists", href: `${BLS}/healthcare/dental-hygienists.htm` },
            ", ",
            {
              text: "HVAC/R mechanics and installers",
              href: `${BLS}/installation-maintenance-and-repair/heating-air-conditioning-and-refrigeration-mechanics-and-installers.htm`,
            },
            ", ",
            { text: "paralegals", href: `${BLS}/legal/paralegals-and-legal-assistants.htm` },
            ", ",
            { text: "logisticians", href: `${BLS}/business-and-financial/logisticians.htm` },
            ", ",
            {
              text: "medical records specialists",
              href: `${BLS}/healthcare/medical-records-and-health-information-technicians.htm`,
            },
            ", ",
            {
              text: "information security analysts",
              href: `${BLS}/computer-and-information-technology/information-security-analysts.htm`,
            },
            ", ",
            {
              text: "buyers and purchasing agents",
              href: `${BLS}/business-and-financial/purchasing-managers-buyers-and-purchasing-agents.htm`,
            },
            ", ",
            { text: "data scientists", href: `${BLS}/math/data-scientists.htm` },
          ],
          [{ text: "City College of San Francisco, Free City", href: "https://ccsf.edu/freecity" }],
          [{ text: "Calbright College, programs", href: "https://www.calbright.edu/programs/" }],
        ],
      },
    ],
  },
  {
    slug: "understanding-ats",
    title: "Understanding applicant tracking systems (ATS): how to optimize your resume",
    date: "2026-10-15",
    category: "Job search",
    summary:
      "Navigate automated hiring systems, tailor your resume, and improve your application strategy with Savant Talent.",
    blocks: [
      { type: "h2", text: "What is an applicant tracking system?" },
      {
        type: "p",
        content: [
          "An Applicant Tracking System (ATS) is software that helps employers manage job postings, organize applications, and review candidate qualifications. Depending on the system and employer, an ATS may extract resume information, search for relevant keywords, and help recruiters identify applicants whose qualifications align with a position.",
        ],
      },

      { type: "h2", text: "Why does ATS compatibility matter?" },
      {
        type: "p",
        content: [
          "Submitting a resume online does not guarantee that a recruiter will review it immediately. Employers may use automated tools to organize or prioritize applications, making it important to communicate your qualifications clearly and effectively.",
        ],
      },
      {
        type: "p",
        content: [
          "A resume that fails to highlight relevant skills, experience, or terminology may not adequately demonstrate your suitability for a position, even when you possess the necessary qualifications.",
        ],
      },

      { type: "h2", text: "How can you optimize your resume?" },
      { type: "p", content: ["Three practical strategies can help strengthen your applications:"] },
      {
        type: "ul",
        items: [
          [
            { bold: "Use relevant keywords." },
            " Identify the skills, qualifications, and terminology emphasized in the job description. Incorporate them naturally when they accurately reflect your experience.",
          ],
          [
            { bold: "Maintain clear formatting." },
            " Use conventional section headings, readable fonts, and a straightforward layout to support resume parsing and readability.",
          ],
          [
            { bold: "Tailor your resume to each role." },
            " Emphasize the experience, skills, projects, and accomplishments most relevant to the position rather than submitting the same generic resume for every opportunity.",
          ],
        ],
      },

      { type: "h2", text: "Why resume tailoring matters" },
      {
        type: "p",
        content: [
          "Different positions may require different combinations of skills, experience, and qualifications. Your professional background may be relevant to several career paths, but a single resume may not communicate that relevance equally well to every employer.",
        ],
      },
      {
        type: "p",
        content: [
          {
            bold: "Savant Talent helps address this challenge through resume building designed to support multiple role-specific alternatives.",
          },
          " Instead of relying on one general-purpose resume, job seekers can develop and refine different versions that emphasize their qualifications for distinct positions and career paths.",
        ],
      },
      {
        type: "p",
        content: [
          "For example, a candidate with experience in customer service, administration, and data entry could prepare tailored resume versions for customer support, administrative assistance, and entry-level data operations roles. Each version can highlight the most relevant qualifications while accurately representing the candidate's background.",
        ],
      },

      { type: "h2", text: "Take the next step" },
      {
        type: "p",
        content: [
          "A stronger job search begins with understanding the position, identifying the qualifications employers seek, and presenting your experience accordingly. Combine an ATS-friendly format with thoughtful resume tailoring to make your applications more relevant and easier to evaluate.",
        ],
      },
    ],
    cta: {
      title: "Build your resume with Savant Talent",
      body: "Create alternatives for different roles, tailor your qualifications to each opportunity, and approach your next application with a more focused strategy.",
      label: "Start your resume →",
      to: "/talent/profile",
    },
  },
];

/** Rough reading time from the text in an entry's blocks (about 230 words a minute). */
export function readMinutes(entry: JournalEntry): number {
  const text = (parts: Inline[]) =>
    parts.map((p) => (typeof p === "string" ? p : "bold" in p ? p.bold : p.text)).join(" ");
  const words = entry.blocks
    .map((b) =>
      b.type === "h2"
        ? b.text
        : b.type === "p"
          ? text(b.content)
          : b.type === "ul"
            ? b.items.map(text).join(" ")
            : b.rows.map((r) => r.map(text).join(" ")).join(" "),
    )
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}

/** Newest first. */
export const SORTED_ENTRIES = [...ENTRIES].sort((a, b) => b.date.localeCompare(a.date));

export const getEntry = (slug: string) => ENTRIES.find((e) => e.slug === slug);
