import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Savant Staffing" },
      {
        name: "description",
        content:
          "How Savant Staffing collects, uses, shares and protects personal information on savantalent.com, and your privacy rights.",
      },
    ],
  }),
  component: PrivacyPolicy,
});

const UPDATED = "September 30, 2026";
const EMAIL = "info@savantalent.com";

const SECTIONS = [
  ["who", "Who we are"],
  ["collect", "Information we collect"],
  ["use", "How we use information"],
  ["share", "Who we share it with"],
  ["storage", "Cookies and browser storage"],
  ["savant-apply", "Savant Apply"],
  ["retention", "How long we keep it"],
  ["security", "Security"],
  ["choices", "Your choices"],
  ["rights", "Your privacy rights"],
  ["california", "Notice for California residents"],
  ["children", "Children"],
  ["international", "Users outside the United States"],
  ["changes", "Changes to this policy"],
  ["contact", "Contact"],
] as const;

/**
 * Site-wide privacy policy. Keep it in step with what the app stores
 * (src/integrations/supabase/types.ts), who can read it (RLS in
 * supabase/migrations — note talent_profiles.visible_to_recruiters defaults
 * to true), and the providers it calls. The extension has its own policy at
 * /autofill/privacy.
 */
function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Legal</p>
      <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">Privacy Policy</h1>
      <p className="mt-4 text-sm text-muted-foreground">Last updated {UPDATED}</p>

      <p className="mt-10 text-base leading-relaxed">
        This policy explains what personal information Savant Staffing collects when you use
        savantalent.com and its tools, how we use and share it, and the choices and rights you have.
        The short version: we use your information to help you find work (or find people), we don't
        sell it, and we don't use advertising trackers.
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
        <Section id="who">
          <p>
            Savant Staffing (“Savant”, “we”, “us”) operates savantalent.com, the Savant job feed,
            Employer Ratings, Insights, the talent, recruiter and coach hubs, and the Savant Apply
            browser extension (together, the “Services”). Savant is responsible for the personal
            information described here. Contact us at <Mail />. Use of the Services is also governed
            by our{" "}
            <Link to="/terms" className="underline underline-offset-4">
              Terms of Use
            </Link>
            .
          </p>
        </Section>

        <Section id="collect">
          <h3 className="font-medium">Information you give us</h3>
          <List>
            <li>
              <strong>Account details:</strong> your name or username, email address, phone number
              (optional), password, and account type (talent, recruiter or coach). Passwords are
              handled by our sign-in provider; we never see them.
            </li>
            <li>
              <strong>Talent profile:</strong> name, headline, current title and company, location,
              skills, links (LinkedIn, GitHub, portfolio), salary expectation, earliest start date,
              whether you're authorized to work in the U.S. and need visa sponsorship, and your
              résumé (the file and its text).
            </li>
            <li>
              <strong>Job preferences:</strong> positions, industries, locations, schedule, minimum
              pay, remote work and the temp apps you use.
            </li>
            <li>
              <strong>Applications and activity:</strong> jobs you bookmark or apply to, application
              status and interview details, requests from recruiters and your responses, and answers
              you save while applying.
            </li>
            <li>
              <strong>Career services:</strong> when you sign up for coaching, résumé help,
              interview practice or job fairs — your goals, availability, preferred contact method
              and phone number.
            </li>
            <li>
              <strong>Recruiter and organization details:</strong> your organization's name,
              website, industry and description, and notes you keep on candidates.
            </li>
            <li>
              <strong>Messages:</strong> what you send through the contact form (name, email,
              company, message) and in-app messages and notifications.
            </li>
          </List>
          <p>
            We don't ask for demographic information such as race, gender, veteran or disability
            status, and Savant Apply never saves it.
          </p>

          <h3 className="pt-2 font-medium">Information collected automatically</h3>
          <List>
            <li>
              <strong>Sign-in session:</strong> a session token stored in your browser to keep you
              signed in.
            </li>
            <li>
              <strong>Technical logs:</strong> our hosting and database providers record standard
              request information — such as IP address, browser type, pages requested and time — to
              run, secure and troubleshoot the Services.
            </li>
          </List>
          <p>We don't use analytics trackers, advertising pixels or third-party ad cookies.</p>

          <h3 className="pt-2 font-medium">Information from others</h3>
          <List>
            <li>
              <strong>Google:</strong> if you sign in with Google, the name and email address on
              your Google account.
            </li>
            <li>
              <strong>Employers and recruiters:</strong> updates about your applications, such as
              status changes and interview scheduling.
            </li>
            <li>
              <strong>Public sources:</strong> job listings and employer data (for example company
              career sites, the U.S. Department of Labor and published employer rankings). These
              describe employers and jobs, not you.
            </li>
          </List>
        </Section>

        <Section id="use">
          <p>We use personal information to:</p>
          <List>
            <li>create and secure your account and keep you signed in;</li>
            <li>rank and filter jobs for you based on your profile and preferences;</li>
            <li>
              help you apply — including filling in applications with Savant Apply when you ask —
              and track your applications;
            </li>
            <li>connect talent with recruiters and coaches, as described below;</li>
            <li>respond to messages and provide the career services you request;</li>
            <li>
              send service messages about your account and applications, and notifications you can
              turn off;
            </li>
            <li>
              keep the Services safe — detecting fraud, ghost or scam listings, abuse and scraping;
            </li>
            <li>improve the Services, and meet our legal obligations.</li>
          </List>
          <p>
            Work authorization and sponsorship answers are used only to match you with jobs you can
            take and to fill in applications that ask for them.
          </p>
        </Section>

        <Section id="share">
          <List>
            <li>
              <strong>Recruiters on Savant:</strong> recruiters can find talent profiles (including
              résumés) in their talent feed and invite you to apply. Your email and phone stay
              private until you accept an invitation.{" "}
              <strong>Your profile is visible to recruiters unless you turn this off</strong> with
              “Visible to recruiters” on your profile page.
            </li>
            <li>
              <strong>Recruiters and coaches a Savant admin assigns to you:</strong> while the
              assignment is active, they can see your full profile, contact details, job preferences
              and résumé so they can work with you. Access ends when the assignment ends. You can
              ask us who is assigned to you, or to end an assignment, at any time.
            </li>
            <li>
              <strong>Employers you apply to:</strong> recruiters for a job's organization can see
              your application to that job and update its status. When you apply on an employer's or
              staffing partner's own site, you share your application with them directly, under
              their privacy policy.
            </li>
            <li>
              <strong>Career coaches:</strong> when you sign up for a career service, our admins
              review it and assign a coach, who then sees the details you shared. To ask to coach
              someone, coaches can browse a limited list showing first name and last initial,
              headline, location and skills — never contact details or résumés.
            </li>
            <li>
              <strong>Service providers</strong> who process data for us: Lovable (website hosting),
              Supabase (database, sign-in and file storage), Google (optional sign-in), Resend
              (email delivery) and Anthropic (drafting suggested answers in Savant Apply). They may
              only use it to provide their services to us.
            </li>
            <li>
              <strong>Legal and safety:</strong> when required by law or legal process, or to
              protect the rights, property or safety of Savant, our users or others.
            </li>
            <li>
              <strong>Business transfers:</strong> as part of a merger, acquisition or sale of
              assets, in which case this policy continues to apply.
            </li>
          </List>
          <p>
            We do not sell personal information, and we do not share it for cross-context behavioral
            advertising.
          </p>
        </Section>

        <Section id="storage">
          <p>
            We use your browser's storage only for things the Services need: keeping you signed in,
            and remembering settings such as “Always autofill”. We don't use advertising or
            cross-site tracking cookies. Because we don't sell or share personal information, we
            treat Global Privacy Control signals as already honored.
          </p>
        </Section>

        <Section id="savant-apply">
          <p>
            The Savant Apply browser extension has its own{" "}
            <Link to="/autofill/privacy" className="underline underline-offset-4">
              privacy policy
            </Link>{" "}
            covering what it reads on application forms, what it sends, and what it never collects.
          </p>
        </Section>

        <Section id="retention">
          <p>
            We keep account and profile information, applications and saved answers for as long as
            your account is open. When you delete your account (Settings → Delete account), your
            account, profile, résumé files, preferences, applications, saved answers, messages and
            the contact-form messages you sent us are deleted immediately. We keep only a record
            that an account was deleted, with the date and account type and nothing that identifies
            you, as privacy laws require. Copies in our providers' backups are overwritten on their
            regular backup schedule. Contact-form messages from people without an account are kept
            as long as needed to respond and follow up. Technical logs are kept for the periods our
            providers set, typically a few weeks.
          </p>
        </Section>

        <Section id="security">
          <List>
            <li>Data is encrypted in transit (HTTPS).</li>
            <li>
              Database access rules limit who can read what — for example, talent data is readable
              only by you, by recruiters as described above, and by authorized Savant staff.
            </li>
            <li>Résumé files are shared only through links that expire.</li>
          </List>
          <p>
            No system is perfectly secure. If you think your account has been compromised, change
            your password and email us at <Mail />.
          </p>
        </Section>

        <Section id="choices">
          <List>
            <li>
              Update your profile, preferences and account details at any time from your dashboard.
            </li>
            <li>
              Turn off “Visible to recruiters” on your profile page to hide your profile from
              recruiters.
            </li>
            <li>Turn off email notifications in your account settings.</li>
            <li>Edit or delete saved answers on the Saved Answers page.</li>
            <li>
              Delete your account at any time in Settings → Delete account. It takes effect
              immediately. You can also email <Mail /> from your account's email address and we'll
              do it for you.
            </li>
          </List>
        </Section>

        <Section id="rights">
          <p>Depending on where you live, you may have the right to:</p>
          <List>
            <li>know what personal information we hold about you and get a copy of it;</li>
            <li>correct inaccurate information;</li>
            <li>delete your information;</li>
            <li>
              opt out of the sale or sharing of personal information — we don't sell or share it;
            </li>
            <li>
              limit the use of sensitive personal information — we only use it as described above;
            </li>
            <li>not be discriminated against for using these rights.</li>
          </List>
          <p>
            To make a request, email <Mail /> from the address on your account. We'll verify your
            identity before acting and respond within 45 days. You can use an authorized agent with
            your written permission. If we deny a request, you can reply to ask us to reconsider.
          </p>
        </Section>

        <Section id="california">
          <p>
            Under the California Consumer Privacy Act, in the past 12 months we have collected these
            categories of personal information, from the sources and for the purposes described in
            sections 2 and 3:
          </p>
          <List>
            <li>
              <strong>Identifiers:</strong> name, email, phone, account ID, IP address.
            </li>
            <li>
              <strong>Professional or employment information:</strong> résumé, work history, current
              title and company, skills, salary expectation, job preferences and applications.
            </li>
            <li>
              <strong>Internet activity:</strong> technical logs and activity within the Services.
            </li>
            <li>
              <strong>Sensitive personal information:</strong> account sign-in credentials, and work
              authorization or visa sponsorship status. We use these only to provide the Services,
              not to infer characteristics about you.
            </li>
          </List>
          <p>
            We disclose these categories for business purposes to the service providers, recruiters,
            employers and coaches described in section 4. We have not sold or shared personal
            information, including that of consumers under 16.
          </p>
        </Section>

        <Section id="children">
          <p>
            The Services are for people aged 16 and older. We don't knowingly collect personal
            information from children under 16. If you believe a child has given us information,
            email <Mail /> and we'll delete it.
          </p>
        </Section>

        <Section id="international">
          <p>
            The Services are designed for job seekers and employers in the United States. If you use
            them from elsewhere, your information will be processed in the United States and other
            countries where our providers operate.
          </p>
        </Section>

        <Section id="changes">
          <p>
            If we change this policy, we'll update the date at the top. For significant changes,
            we'll also notify you on the Services or by email before they take effect.
          </p>
        </Section>

        <Section id="contact">
          <p>
            Questions, requests or complaints about privacy: <Mail />.
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
