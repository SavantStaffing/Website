import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createFileRoute("/autofill_/privacy")({
  head: () => ({
    meta: [
      { title: "Savant Apply privacy policy" },
      {
        name: "description",
        content: "What the Savant Apply browser extension reads, sends, stores and never collects.",
      },
    ],
  }),
  component: SavantApplyPrivacy,
});

const UPDATED = "September 30, 2026";

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

      <div className="mt-12 space-y-12 text-sm leading-relaxed">
        <p className="text-base">
          Savant Apply is a browser extension from Savant Staffing that fills in job applications
          from your Savant talent profile. This policy explains what it reads, what it sends to
          Savant, what is stored, and what it never collects. It covers the extension; your use of
          savantalent.com is also covered by your Savant account.
        </p>

        <Section title="What the extension reads">
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
              (see below).
            </li>
            <li>
              <strong>Your Savant sign-in.</strong> When you're signed in on savantalent.com, the
              site passes your session token to the extension so it can act as you.
            </li>
          </List>
          <p>
            It does not run on any other website, and it does not read your browsing history, other
            tabs, or pages you visit.
          </p>
        </Section>

        <Section title="What is sent, and to whom">
          <List>
            <li>
              <strong>To Savant (savantalent.com):</strong> the form questions and job description,
              to work out which answers from your profile fit each question; and, on submit, your
              answers and the application's web address.
            </li>
            <li>
              <strong>Back to the form, from Savant:</strong> details from your Savant profile —
              such as your name, email, phone, location, links and résumé file — which the extension
              types into the form in your browser.
            </li>
            <li>
              <strong>To Anthropic (optional):</strong> for open-ended questions your profile
              doesn't answer (for example “Why do you want to work here?”), Savant may send the
              question, the job description and your résumé text to Anthropic's Claude AI to draft
              an answer. Drafts are always marked for your review. Anthropic processes this data to
              provide the service to Savant and doesn't use it to train its models under its
              commercial terms.
            </li>
            <li>
              <strong>To the employer:</strong> nothing, until you press the employer's submit
              button yourself. Savant Apply never submits an application for you.
            </li>
          </List>
        </Section>

        <Section title="What is stored">
          <List>
            <li>
              <strong>In your browser:</strong> only your Savant session token, in the extension's
              local storage, so it can reach your profile. It's removed when you sign out of Savant
              or remove the extension.
            </li>
            <li>
              <strong>In your Savant account:</strong> the answers you submitted, as{" "}
              <Link to="/talent/answers" className="underline underline-offset-4">
                Saved Answers
              </Link>{" "}
              you can edit or delete at any time; a record of each autofill (the job, which fields
              were filled and whether you submitted), with résumé links removed; and the
              application's status on your Savant dashboard.
            </li>
          </List>
        </Section>

        <Section title="What it never collects">
          <List>
            <li>
              Demographic answers — gender, race or ethnicity, veteran status, disability status —
              are never saved, even when a form asks for them.
            </li>
            <li>
              Passwords, payment details, or anything from sites other than those listed above.
            </li>
            <li>Browsing activity, analytics or advertising identifiers.</li>
          </List>
        </Section>

        <Section title="How the data is used">
          <p>
            Only to fill in and track your job applications and to reuse your answers on later
            applications. Savant does not sell this data, share it with advertisers, or use it for
            anything unrelated to applying for jobs. Our use of this information complies with the
            Chrome Web Store User Data Policy, including the Limited Use requirements.
          </p>
        </Section>

        <Section title="Your choices">
          <List>
            <li>Edit or delete saved answers on the Saved Answers page.</li>
            <li>
              Turn autofill off per application (“Apply without autofill”), or remove the extension
              at any time from your browser's extensions page.
            </li>
            <li>
              To delete your Savant account and its data, email{" "}
              <a href="mailto:info@savantalent.com" className="underline underline-offset-4">
                info@savantalent.com
              </a>
              .
            </li>
          </List>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or your data:{" "}
            <a href="mailto:info@savantalent.com" className="underline underline-offset-4">
              info@savantalent.com
            </a>
            . If we change what the extension collects, we'll update this page and the date above.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-3 pl-5 marker:text-muted-foreground">{children}</ul>;
}
