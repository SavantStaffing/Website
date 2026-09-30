import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Badge, card, label, mutedButton, primaryButton } from "@/components/site/ui";
import {
  AUTOFILL_ATS_LABEL,
  SAVANT_APPLY_DOWNLOAD,
  useSavantApply,
  type ExtensionStatus,
} from "@/lib/autofill/extension";

export const Route = createFileRoute("/autofill")({
  head: () => ({
    meta: [
      { title: "Savant Apply — autofill job applications" },
      {
        name: "description",
        content:
          "Install Savant Apply, the browser extension that fills job applications from your Savant profile. You review and submit.",
      },
    ],
  }),
  component: AutofillGuide,
});

const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: "Download Savant Apply",
    body: (
      <>
        <a href={SAVANT_APPLY_DOWNLOAD} download className="underline underline-offset-4">
          Download the zip file
        </a>
        , then unzip it (double-click it on a Mac; on Windows, right-click → <em>Extract All</em>
        ). You'll get a folder called <strong>savant-apply</strong>. Keep it somewhere it won't be
        deleted, like your Documents folder — the browser loads the extension from it.
      </>
    ),
  },
  {
    title: "Open your browser's extensions page",
    body: (
      <>
        Type <Code>chrome://extensions</Code> into the address bar in Chrome, or{" "}
        <Code>edge://extensions</Code> in Microsoft Edge, and press Enter.
      </>
    ),
  },
  {
    title: "Turn on Developer mode",
    body: (
      <>
        In Chrome it's the switch in the top-right corner of the page; in Edge it's in the left
        sidebar. This lets you add an extension from a folder while Savant Apply is on its way to
        the Chrome Web Store.
      </>
    ),
  },
  {
    title: "Click “Load unpacked” and choose the folder",
    body: (
      <>
        Select the <strong>savant-apply</strong> folder you unzipped (the one that contains{" "}
        <Code>manifest.json</Code>). Savant Apply appears in your list of extensions.
      </>
    ),
  },
  {
    title: "Pin it and connect your account",
    body: (
      <>
        Click the puzzle-piece icon next to the address bar and pin Savant Apply. Then{" "}
        <Link
          to="/auth"
          search={{ mode: "login" } as never}
          className="underline underline-offset-4"
        >
          sign in to Savant
        </Link>{" "}
        (or reload Savant if you're already signed in) — that links the extension to your profile.
      </>
    ),
  },
];

function AutofillGuide() {
  const { status, recheck } = useSavantApply();
  const sites = Object.values(AUTOFILL_ATS_LABEL);

  return (
    <div className="mx-auto max-w-4xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Savant Apply</p>
      <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">
        Apply faster.
        <br />
        Stay in control.
      </h1>
      <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Savant Apply is a free browser extension that fills in job applications from your Savant
        profile — your details, résumé and the answers you've saved — so you're not typing the same
        things into every form. You review every field and press submit yourself.
      </p>

      <div className={`mt-12 ${card}`}>
        <StatusPanel status={status} onRecheck={recheck} />
      </div>

      <section className="mt-20">
        <h2 className="text-3xl font-semibold">Install in about 2 minutes</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Works in Chrome, Microsoft Edge and other Chromium browsers (Brave, Arc) on a computer.
          Browser extensions can't run on phones.
        </p>
        <ol className="mt-10 border-t border-[color:var(--color-hairline)]">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="grid gap-4 border-b border-[color:var(--color-hairline)] py-8 md:grid-cols-[4rem_1fr]"
            >
              <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <h3 className="text-xl font-medium">{s.title}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <a href={SAVANT_APPLY_DOWNLOAD} download className={`inline-block ${primaryButton}`}>
            Download Savant Apply
          </a>
        </div>
      </section>

      <section className="mt-24 grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold">Using it</h2>
          <ul className="mt-6 space-y-3 text-sm leading-relaxed">
            <Point>
              On your Savant job feed, roles marked <Badge tone="good">Autofill ready</Badge> can be
              filled for you. Click Apply, then <strong>Autofill &amp; continue</strong>.
            </Point>
            <Point>
              The employer's application opens and fills itself in. Fields are outlined:{" "}
              <strong className="text-emerald-700 dark:text-emerald-400">green</strong> filled from
              your profile, <strong className="text-amber-700 dark:text-amber-400">amber</strong>{" "}
              worth a second look, <strong className="text-red-700 dark:text-red-400">red</strong>{" "}
              still needs your answer.
            </Point>
            <Point>
              On any supported application page you can also click the{" "}
              <strong>Autofill with Savant</strong> button in the bottom-right corner.
            </Point>
            <Point>Check everything, answer what's left, and submit.</Point>
          </ul>
          <p className="mt-6 text-xs text-muted-foreground">
            Works on application forms hosted by {sites.slice(0, -1).join(", ")} and {sites.at(-1)},
            which many employers on Savant use. More are coming.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-semibold">What it never does</h2>
          <ul className="mt-6 space-y-3 text-sm leading-relaxed">
            <Point>
              <strong>Never submits for you.</strong> Every application is sent by you, after you've
              reviewed it.
            </Point>
            <Point>
              <strong>Never saves demographic answers</strong> such as gender, race, veteran or
              disability status.
            </Point>
            <Point>
              <strong>Only runs on application forms</strong> on the sites above and on Savant — not
              on the rest of your browsing.
            </Point>
            <Point>
              When you submit, the answers you typed are kept in your{" "}
              <Link to="/talent/answers" className="underline underline-offset-4">
                Saved Answers
              </Link>{" "}
              so the next form can reuse them. You can edit or delete them any time.
            </Point>
          </ul>
        </div>
      </section>

      <section className="mt-24">
        <h2 className="text-2xl font-semibold">Troubleshooting</h2>
        <dl className="mt-6 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)] text-sm">
          <Faq q="The button says “Sign in to Savant first”">
            Open savantalent.com in the same browser while signed in, or reload it. That hands your
            session to the extension.
          </Faq>
          <Faq q="Chrome warns about developer-mode extensions">
            That's expected for extensions added with “Load unpacked”. Keep Savant Apply enabled;
            the reminder goes away once it's in the Chrome Web Store.
          </Faq>
          <Faq q="Nothing happens on the application page">
            Some employers split the form over several steps — open the step with the form fields,
            then click <strong>Autofill with Savant</strong>. If the page isn't on one of the
            supported sites, fill it in the usual way.
          </Faq>
          <Faq q="How do I update it?">
            Download the zip again, replace your <strong>savant-apply</strong> folder with the new
            one, then click the reload arrow on Savant Apply's card at{" "}
            <Code>chrome://extensions</Code>.
          </Faq>
          <Faq q="How do I remove it?">
            Go to <Code>chrome://extensions</Code> (or <Code>edge://extensions</Code>) and click{" "}
            <em>Remove</em> on Savant Apply. You can then delete the folder.
          </Faq>
        </dl>
      </section>
    </div>
  );
}

function StatusPanel({ status, onRecheck }: { status: ExtensionStatus; onRecheck: () => void }) {
  const recheck = (
    <button type="button" onClick={onRecheck} className={mutedButton}>
      Check again
    </button>
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className={label}>This browser</p>
        <p className="mt-2 text-lg font-medium">
          {status.state === "checking" && "Checking for Savant Apply…"}
          {status.state === "installed" &&
            (status.connected
              ? `Savant Apply ${status.version} is installed and connected.`
              : `Savant Apply ${status.version} is installed. Sign in to Savant to connect it.`)}
          {status.state === "missing" && "Savant Apply isn't installed yet."}
          {status.state === "unsupported" &&
            "This browser can't run Savant Apply. Use Chrome or Edge on a computer."}
        </p>
      </div>
      {status.state === "installed" ? (
        <Badge tone={status.connected ? "good" : "warn"}>
          {status.connected ? "Ready" : "Not connected"}
        </Badge>
      ) : status.state === "missing" ? (
        recheck
      ) : null}
    </div>
  );
}

function Point({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="text-brass">
        —
      </span>
      <span>{children}</span>
    </li>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 py-5 md:grid-cols-[18rem_1fr] md:gap-8">
      <dt className="font-medium">{q}</dt>
      <dd className="leading-relaxed text-muted-foreground">{children}</dd>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm border border-[color:var(--color-hairline)] px-1.5 py-0.5 text-[0.9em] text-foreground">
      {children}
    </code>
  );
}
