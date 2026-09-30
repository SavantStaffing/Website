import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createFileRoute("/autofill_/privacy")({
  head: () => ({
    meta: [
      { title: "Savant Apply privacy policy" },
      {
        name: "description",
        content:
          "What the Savant Apply browser extension reads, sends, stores and never collects, and your privacy rights.",
      },
    ],
  }),
  component: SavantApplyPrivacy,
});

const UPDATED = "September 30, 2026";
const EMAIL = "info@savantalent.com";

const SECTIONS = [
  ["who", "Who we are"],
  ["reads", "What the extension reads"],
  ["sent", "What is sent, and to whom"],
  ["stored", "What is stored"],
  ["never", "What it never collects"],
  ["use", "How the data is used"],
  ["providers", "Service providers"],
  ["retention", "How long we keep it"],
  ["security", "Security"],
  ["choices", "Your choices"],
  ["rights", "Your privacy rights"],
  ["children", "Children"],
  ["changes", "Changes to this policy"],
  ["contact", "Contact"],
] as const;

/**
 * Privacy policy for the Savant Apply extension, linked from its Chrome Web
 * Store listing. Keep it in step with extension/ and src/lib/autofill/:
 * what content.js reads, what background.js sends, and what
 * autofill.server.ts / drafter.server.ts store or forward.
 */
function SavantApplyPrivacy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Savant Apply</p>
      <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">Privacy policy</h1>
      <p className="mt-4 text-sm text-muted-foreground">Last updated {UPDATED}</p>

      <p className="mt-10 text-base leading-relaxed">
        Savant Apply is a browser extension from Savant Staffing that fills in job applications from
        your Savant talent profile. This policy explains what it reads, what it sends to Savant,
        what is stored, what it never collects, and the rights you have over your data. Your use of
        savantalent.com is also governed by our{" "}
        <Link to="/terms" className="underline underline-offset-4">
          Terms of Use
        </Link>
        .
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
            Savant Apply is provided by Savant Staffing (“Savant”, “we”, “us”), which operates
            savantalent.com. Savant is responsible for the personal information described in this
            policy. You can reach us at <Mail />.
          </p>
        </Section>

        <Section id="reads">
          <List>
            <li>
              <strong>Application forms, only on supported sites.</strong> On job application pages
              hosted by Greenhouse (boards.greenhouse.io, job-boards.greenhouse.io), Lever
              (jobs.lever.co) and Ashby (jobs.ashbyhq.com), and only when you click “Autofill with
              Savant” or choose “Autofill &amp; continue” on Savant, it reads the form's question
              labels, answer options and the job description on that page.
            </li>
            <li>
              <strong>Your answers, when you submit.</strong> When you submit an application on one
              of those sites, it reads the answers you entered so they can be saved for next time
              (see “What is stored”).
            </li>
            <li>
              <strong>Your Savant sign-in.</strong> When you're signed in on savantalent.com, the
              site passes your session token to the extension so it can act as you.
            </li>
          </List>
          <p>
            It does not run on any other website, and it does not read your browsing history, other
            tabs, or other pages you visit.
          </p>
        </Section>

        <Section id="sent">
          <List>
            <li>
              <strong>To Savant (savantalent.com):</strong> the form questions and job description,
              to work out which answers from your profile fit each question; and, on submit, your
              answers and the application's web address.
            </li>
            <li>
              <strong>Back to the form, from Savant:</strong> details from your Savant profile —
              such as your name, email, phone, location, links and résumé file — which the extension
              enters into the form in your browser.
            </li>
            <li>
              <strong>To Anthropic (optional):</strong> for open-ended questions your profile
              doesn't answer (for example “Why do you want to work here?”), Savant may send the
              question, the job description and your résumé text to Anthropic's Claude AI to draft
              an answer. Drafts are always marked for your review.
            </li>
            <li>
              <strong>To the employer:</strong> nothing, until you press the employer's submit
              button yourself. Savant Apply never submits an application for you. Once you submit,
              the employer handles your application under its own privacy policy.
            </li>
          </List>
        </Section>

        <Section id="stored">
          <List>
            <li>
              <strong>In your browser:</strong> only your Savant session token, in the extension's
              local storage, so it can reach your profile.
            </li>
            <li>
              <strong>In your Savant account:</strong> the answers you submitted, as{" "}
              <Link to="/talent/answers" className="underline underline-offset-4">
                Saved Answers
              </Link>
              ; a record of each autofill (the job, which fields were filled and whether you
              submitted), with résumé links removed; and the application's status on your Savant
              dashboard.
            </li>
          </List>
        </Section>

        <Section id="never">
          <List>
            <li>
              Demographic answers — gender, race or ethnicity, veteran status, disability status —
              are never saved, even when a form asks for them.
            </li>
            <li>
              Passwords, payment details, or anything from websites other than those listed above.
            </li>
            <li>Browsing history, analytics, advertising identifiers or tracking cookies.</li>
          </List>
        </Section>

        <Section id="use">
          <p>
            Only to fill in and track your job applications and to reuse your answers on later
            applications. We do not sell this data, share it for cross-context behavioral
            advertising, or use it for anything unrelated to applying for jobs. We don't use it to
            make automated decisions about you. Our use of information received through the
            extension complies with the Chrome Web Store User Data Policy, including its Limited Use
            requirements.
          </p>
        </Section>

        <Section id="providers">
          <p>
            We rely on a small number of service providers, who process data only on our behalf:
          </p>
          <List>
            <li>
              <strong>Lovable</strong> — hosts savantalent.com and its backend.
            </li>
            <li>
              <strong>Supabase</strong> — database, sign-in and file storage (including your résumé
              file), as part of that backend.
            </li>
            <li>
              <strong>Anthropic</strong> — drafts answers to open-ended questions, as described
              above. Under its commercial terms, Anthropic does not use this data to train its
              models.
            </li>
          </List>
          <p>
            We may also disclose information if required by law, to protect the rights and safety of
            our users or others, or as part of a merger or acquisition, in which case this policy
            continues to apply to your data.
          </p>
        </Section>

        <Section id="retention">
          <List>
            <li>
              <strong>Session token:</strong> until you sign out of Savant or remove the extension.
            </li>
            <li>
              <strong>Saved answers:</strong> until you edit or delete them, or delete your account.
            </li>
            <li>
              <strong>Autofill records and application statuses:</strong> for as long as your
              account is open, so your applications stay on your dashboard. They're deleted when
              your account is deleted, except where we must keep information to meet a legal
              obligation.
            </li>
          </List>
        </Section>

        <Section id="security">
          <List>
            <li>All data travels over encrypted connections (HTTPS).</li>
            <li>
              The extension only talks to savantalent.com and Savant's file storage, and only
              downloads your own résumé, through a signed link that expires after 10 minutes.
            </li>
            <li>
              In Savant's database, your data is readable only by your account and by authorized
              Savant staff who need it to run the service.
            </li>
            <li>
              Your session token is stored only on your device, in storage other websites can't
              read.
            </li>
          </List>
          <p>
            No system is perfectly secure. If you think your account has been compromised, change
            your password and email us at <Mail />.
          </p>
        </Section>

        <Section id="choices">
          <List>
            <li>Edit or delete saved answers on the Saved Answers page.</li>
            <li>
              Turn autofill off for any application (“Apply without autofill”), or switch off
              “Always autofill”.
            </li>
            <li>
              Remove the extension at any time from your browser's extensions page. This deletes the
              session token it stored.
            </li>
          </List>
        </Section>

        <Section id="rights">
          <p>Depending on where you live, you may have the right to:</p>
          <List>
            <li>know what personal information we hold about you and get a copy of it;</li>
            <li>correct information that's inaccurate;</li>
            <li>delete your information and your Savant account;</li>
            <li>
              opt out of the sale or sharing of your information — we don't sell or share it, so
              there's nothing to opt out of;
            </li>
            <li>not be treated differently for using any of these rights.</li>
          </List>
          <p>
            California residents have these rights under the California Consumer Privacy Act. To use
            any of them, email <Mail /> from the address on your Savant account. We'll confirm it's
            you before acting, and reply within 45 days. You can also ask someone to make a request
            on your behalf with your written permission.
          </p>
        </Section>

        <Section id="children">
          <p>
            Savant Apply and Savant are meant for job seekers aged 16 and older. We don't knowingly
            collect information from children under 16. If you believe a child has given us
            information, email <Mail /> and we'll delete it.
          </p>
        </Section>

        <Section id="changes">
          <p>
            If we change what the extension collects or how we use it, we'll update this page and
            the date at the top before the change takes effect. For significant changes, we'll also
            tell signed-in users on Savant.
          </p>
        </Section>

        <Section id="contact">
          <p>
            Questions or requests about this policy or your data: <Mail />.
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
