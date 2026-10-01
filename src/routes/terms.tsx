import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Savant Staffing" },
      {
        name: "description",
        content:
          "The terms that govern your use of savantalent.com, Savant Apply and Savant's job data, ratings and content.",
      },
    ],
  }),
  component: Terms,
});

const UPDATED = "September 30, 2026";
const EMAIL = "info@savantalent.com";

const SECTIONS = [
  ["agreement", "Agreement to these terms"],
  ["services", "Our services"],
  ["eligibility", "Eligibility and accounts"],
  ["acceptable-use", "Acceptable use"],
  ["automated-access", "No scraping or automated access"],
  ["ip", "Our intellectual property"],
  ["data", "Job data, ratings and third-party content"],
  ["your-content", "Your content"],
  ["employers", "Employers, job listings and applications"],
  ["savant-apply", "Savant Apply"],
  ["privacy", "Privacy"],
  ["feedback", "Feedback"],
  ["copyright", "Copyright complaints"],
  ["termination", "Suspension and termination"],
  ["disclaimers", "Disclaimers"],
  ["liability", "Limitation of liability"],
  ["indemnity", "Indemnification"],
  ["law", "Governing law and disputes"],
  ["general", "General"],
  ["changes", "Changes to these terms"],
  ["contact", "Contact"],
] as const;

/**
 * Terms of Use for savantalent.com. The automated-access and IP sections
 * protect the job feed, Employer Ratings and Insights data; public/robots.txt
 * carries the matching crawler rules.
 */
function Terms() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Legal</p>
      <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">Terms of Use</h1>
      <p className="mt-4 text-sm text-muted-foreground">Last updated {UPDATED}</p>

      <p className="mt-10 text-base leading-relaxed">
        Please read these terms carefully. They're a binding agreement between you and Savant
        Staffing about your use of savantalent.com and everything on it. Sections 5 and 6 limit how
        the site and its data may be copied or collected, and section 18 covers how disputes are
        resolved.
      </p>

      <nav
        aria-label="On this page"
        className="mt-10 border-y border-[color:var(--color-hairline)] py-6"
      >
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          On this page
        </p>
        <ol className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {SECTIONS.map(([id, title], i) => (
            <li key={id}>
              <a href={`#${id}`} className="[@media(hover:hover)]:hover:underline">
                {i + 1}. {title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-12 space-y-12 text-sm leading-relaxed">
        <Section id="agreement">
          <p>
            These Terms of Use (“Terms”) govern your access to and use of savantalent.com, its job
            feed, Employer Ratings, Insights, talent, recruiter and coach tools, the Savant Apply
            browser extension, and any related services (together, the “Services”), provided by
            Savant Staffing (“Savant”, “we”, “us”). By accessing or using the Services, or by
            creating an account, you agree to these Terms. If you don't agree, don't use the
            Services.
          </p>
        </Section>

        <Section id="services">
          <p>
            Savant helps people find work and helps employers find people. We collect and curate job
            listings, rate employers, publish labor-market insights, and offer tools to prepare for
            and apply to jobs. We may change, add or remove features at any time.
          </p>
        </Section>

        <Section id="eligibility">
          <List>
            <li>You must be at least 16 years old to use the Services.</li>
            <li>
              Give accurate information when you create an account, and keep it up to date. One
              person per account; accounts can't be shared, sold or transferred.
            </li>
            <li>
              You're responsible for keeping your password secure and for activity on your account.
              Tell us right away at <Mail /> if you think your account has been used without
              permission.
            </li>
            <li>
              If you use the Services for an organization, you confirm you're authorized to accept
              these Terms for it.
            </li>
          </List>
        </Section>

        <Section id="acceptable-use">
          <p>You agree not to, and not to help anyone else to:</p>
          <List>
            <li>break any law, or use the Services to discriminate unlawfully in hiring;</li>
            <li>
              post false, misleading or fraudulent information, including fake job postings, résumés
              or identities, or impersonate any person or organization;
            </li>
            <li>harass, threaten or spam other users, employers or Savant staff;</li>
            <li>
              upload viruses or harmful code, or probe, scan or test the vulnerability of the
              Services;
            </li>
            <li>
              get around or interfere with security features, access controls, rate limits or other
              technical measures;
            </li>
            <li>
              access accounts, data or areas of the Services you're not authorized to access,
              including other users' information;
            </li>
            <li>
              use the Services in a way that could damage, overload or impair them or interfere with
              anyone else's use.
            </li>
          </List>
        </Section>

        <Section id="automated-access">
          <p>
            The job listings, employer ratings, scores, insights and other content on the Services
            took significant work to collect, verify and organize. Unless we've agreed otherwise in
            writing, you may not:
          </p>
          <List>
            <li>
              use any robot, spider, crawler, scraper, headless browser, script or other automated
              means to access, collect, copy, index or monitor any part of the Services or their
              content;
            </li>
            <li>
              harvest, mine, extract or download data from the Services in bulk, including job
              listings, employer information, ratings, scores, insights or user information;
            </li>
            <li>
              use any content or data from the Services to train, fine-tune, test or improve any
              artificial-intelligence or machine-learning model, or to build a dataset;
            </li>
            <li>
              build, contribute to or supply a competing job board, ratings service, database or
              product using content or data from the Services;
            </li>
            <li>
              frame, mirror or republish the Services or substantial parts of their content, or
              deep-link in a way that suggests an affiliation with Savant;
            </li>
            <li>
              access the Services' APIs or internal endpoints except through the Services'
              interfaces and the Savant Apply extension as intended;
            </li>
            <li>
              decompile, reverse engineer or disassemble the Services or Savant Apply, except where
              the law expressly allows it.
            </li>
          </List>
          <p>
            General-purpose search engines may index public pages in line with our{" "}
            <a href="/robots.txt" className="underline underline-offset-4">
              robots.txt
            </a>
            , only to show links and short snippets in search results. That permission doesn't
            extend to AI training or dataset building, and we can withdraw it at any time.
          </p>
          <p>
            We monitor for automated access and may block it, limit it or suspend accounts involved.
            Unauthorized automated access may also violate laws such as the U.S. Computer Fraud and
            Abuse Act and California Penal Code section 502, and we may seek any remedy available,
            including an injunction. For data or API access, ask us at <Mail />.
          </p>
        </Section>

        <Section id="ip">
          <p>
            The Services and everything in them that Savant creates — including the software,
            design, text, graphics, the Savant name and logo, the Employer Ratings methodology,
            ratings and scores, the Job Scout and its classifications, insights, and the selection,
            arrangement and compilation of job listings and data — belong to Savant or its licensors
            and are protected by copyright, trademark, database and other laws. We keep all rights
            not expressly granted in these Terms.
          </p>
          <p>
            As long as you follow these Terms, we give you a limited, personal, non-exclusive,
            non-transferable, revocable license to use the Services for your own job search, hiring
            or career development. You may share links to individual pages, and quote short excerpts
            with attribution to Savant for personal or news purposes. Any other copying,
            distribution, sale, or commercial use needs our written permission.
          </p>
          <p>
            “Savant”, “Savant Staffing”, “Savant Apply” and our logos are our trademarks. Don't use
            them in a way that suggests we endorse or are affiliated with you or your product.
          </p>
        </Section>

        <Section id="data">
          <List>
            <li>
              <strong>Job listings</strong> come from employers' own career sites, staffing partners
              and job-search services. The listings themselves belong to their owners; our
              collection, classification, checks and presentation of them belong to Savant.
            </li>
            <li>
              <strong>Employer Ratings and ethics scores</strong> combine public and licensed
              sources — for example JUST Capital, As You Sow, the World Benchmarking Alliance (via
              Wikirate, under CC BY 4.0) and U.S. Department of Labor records — with Savant's own
              methodology. They're our opinions and summaries for information only, not statements
              of fact about any employer, and not advice.
            </li>
            <li>
              <strong>Third-party content</strong> stays subject to its owners' terms and licenses,
              which we credit where required (for example “Jobs by Adzuna”).
            </li>
          </List>
        </Section>

        <Section id="your-content">
          <p>
            You own what you add to Savant — your profile, résumé, answers, messages and other
            content (“Your Content”). You give Savant a worldwide, non-exclusive, royalty-free
            license to host, store, copy, process and display Your Content only to run, improve and
            provide the Services to you — for example to match you to jobs, fill in applications you
            ask us to fill, and share your profile with employers or recruiters when you choose to.
            You're responsible for Your Content and confirm you have the right to share it and that
            it's accurate. We may remove content that breaks these Terms.
          </p>
        </Section>

        <Section id="employers">
          <List>
            <li>
              Savant isn't the employer for jobs listed on the Services unless a listing says so.
              Employers and staffing partners make their own hiring decisions and are responsible
              for their listings, pay, and employment terms.
            </li>
            <li>
              We work to remove ghost, stale and fraudulent listings, but we can't guarantee that
              any listing is accurate, current or still open. Never pay an employer to apply, and
              report anything suspicious to <Mail />.
            </li>
            <li>
              Applications you submit on an employer's or partner's site are governed by that site's
              terms and privacy policy.
            </li>
            <li>We don't guarantee that you'll be interviewed, hired or placed.</li>
          </List>
        </Section>

        <Section id="savant-apply">
          <p>
            Savant Apply fills in application forms from your profile so you can review them. You
            are responsible for checking every answer and for what you submit — Savant Apply never
            submits for you. How it handles data is described in the{" "}
            <Link to="/autofill/privacy" className="underline underline-offset-4">
              Savant Apply privacy policy
            </Link>
            . The license and restrictions in these Terms apply to the extension.
          </p>
        </Section>

        <Section id="privacy">
          <p>
            Our handling of personal information is described in our{" "}
            <Link to="/privacy" className="underline underline-offset-4">
              Privacy Policy
            </Link>{" "}
            and, for the browser extension, the{" "}
            <Link to="/autofill/privacy" className="underline underline-offset-4">
              Savant Apply privacy policy
            </Link>
            . By using the Services, you acknowledge them.
          </p>
        </Section>

        <Section id="feedback">
          <p>If you send us ideas or suggestions, we may use them without any obligation to you.</p>
        </Section>

        <Section id="copyright">
          <p>
            If you believe content on the Services infringes your copyright, email <Mail /> with:
            your contact details; a description of the work and of the material you believe
            infringes it, with its location on the Services; a statement that you believe in good
            faith the use isn't authorized; a statement, under penalty of perjury, that the notice
            is accurate and that you're the owner or authorized to act for the owner; and your
            physical or electronic signature. We'll respond as the Digital Millennium Copyright Act
            requires, and may close accounts of repeat infringers.
          </p>
        </Section>

        <Section id="termination">
          <p>
            You can stop using the Services and ask us to delete your account at any time. We may
            suspend or end your access, remove content, or block access from particular devices or
            networks if you break these Terms, if we're required to by law, or to protect the
            Services, our users or others. Sections 5, 6, 7, 12, and 15–19 survive termination.
          </p>
        </Section>

        <Section id="disclaimers">
          <p className="uppercase">
            The Services are provided “as is” and “as available”. To the fullest extent the law
            allows, Savant disclaims all warranties, express or implied, including warranties of
            merchantability, fitness for a particular purpose, title, non-infringement, and that the
            Services will be accurate, uninterrupted, secure or error-free.
          </p>
          <p>
            Job listings, ratings, scores, insights and suggested answers are for information only
            and may contain errors. They aren't legal, financial or career advice.
          </p>
        </Section>

        <Section id="liability">
          <p className="uppercase">
            To the fullest extent the law allows, Savant and its owners, staff and partners won't be
            liable for any indirect, incidental, special, consequential or punitive damages, or for
            lost profits, wages, opportunities or data, arising from or related to the Services or
            these Terms. Our total liability for any claim related to the Services is limited to the
            greater of the amount you paid us in the 12 months before the claim, or US $100.
          </p>
          <p>
            Some places don't allow these limits, so they may not all apply to you. Nothing in these
            Terms limits liability that can't be limited by law.
          </p>
        </Section>

        <Section id="indemnity">
          <p>
            If you break these Terms or the law, or your content infringes someone else's rights,
            you agree to defend and compensate Savant and its owners and staff for resulting claims,
            losses and reasonable costs, including legal fees.
          </p>
        </Section>

        <Section id="law">
          <p>
            These Terms are governed by the laws of the State of California and applicable U.S.
            federal law, without regard to conflict-of-law rules. Before filing a claim, please
            contact us at <Mail /> so we can try to resolve it informally within 30 days. Any
            dispute that isn't resolved will be decided exclusively in the state or federal courts
            located in California, and you and Savant agree to their jurisdiction. Either party may
            seek an injunction in any court to stop unauthorized use of its intellectual property or
            of the Services, including scraping.
          </p>
        </Section>

        <Section id="general">
          <p>
            These Terms, with the policies they refer to, are the whole agreement between you and
            Savant about the Services. If any part is unenforceable, the rest stays in effect. Our
            not enforcing a right isn't a waiver of it. You may not transfer your rights under these
            Terms; we may transfer ours as part of a merger, acquisition or sale of assets.
          </p>
        </Section>

        <Section id="changes">
          <p>
            We may update these Terms. We'll post the new version here and change the date at the
            top, and for material changes we'll give notice on the Services or by email before they
            take effect. Continuing to use the Services after the changes take effect means you
            accept them.
          </p>
        </Section>

        <Section id="contact">
          <p>
            Questions about these Terms: <Mail />.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ id, children }: { id: (typeof SECTIONS)[number][0]; children: ReactNode }) {
  const index = SECTIONS.findIndex(([s]) => s === id);
  return (
    <section id={id} className="scroll-mt-28 space-y-4">
      <h2 className="text-2xl font-semibold">
        {index + 1}. {SECTIONS[index][1]}
      </h2>
      {children}
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-3 pl-5 marker:text-muted-foreground">{children}</ul>;
}

function Mail() {
  return (
    <a href={`mailto:${EMAIL}`} className="underline underline-offset-4">
      {EMAIL}
    </a>
  );
}
