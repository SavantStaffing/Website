import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Badge, card, label, mutedButton, primaryButton } from "@/components/site/ui";
import {
  SAVANT_COACH_DOWNLOAD,
  useSavantCoach,
  type ExtensionStatus,
} from "@/lib/autofill/extension";

export const Route = createFileRoute("/coach/extension")({
  head: () => ({
    meta: [{ title: "Savant Coach extension" }, { name: "robots", content: "noindex" }],
  }),
  component: CoachExtensionGuide,
});

const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: "Download Savant Coach",
    body: (
      <>
        <a href={SAVANT_COACH_DOWNLOAD} download className="underline underline-offset-4">
          Download the zip file
        </a>
        , then unzip it (double-click it on a Mac; on Windows, right-click → <em>Extract All</em>
        ). You'll get a folder called <strong>savant-coach</strong>. Keep it somewhere it won't be
        deleted, like your Documents folder. The browser loads the extension from it.
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
        sidebar. This lets you add an extension from a folder while Savant Coach is on its way to
        the Chrome Web Store.
      </>
    ),
  },
  {
    title: "Click “Load unpacked” and choose the folder",
    body: (
      <>
        Select the <strong>savant-coach</strong> folder you unzipped (the one that contains{" "}
        <Code>manifest.json</Code>). Savant Coach appears in your list of extensions.
      </>
    ),
  },
  {
    title: "Pin it and connect your account",
    body: (
      <>
        Click the puzzle-piece icon next to the address bar and pin Savant Coach. Then reload this
        page: you're already signed in to Savant, so that links the extension to your coach account.
        The status box above should say <em>installed and connected</em>.
      </>
    ),
  },
];

function CoachExtensionGuide() {
  const { status, recheck } = useSavantCoach();

  return (
    <div className="max-w-4xl pb-16">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Savant Coach</p>
      <h1 className="mt-4 text-4xl font-semibold leading-tight">Know before you recommend.</h1>
      <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Savant Coach is a free browser extension that checks a job listing for ghost-posting signals
        (listings with no real intent to hire) and tells you <strong>Pass</strong> or{" "}
        <strong>No pass</strong> before you send it to talent. It works on one listing, or on a
        whole Google Sheet of them, and has a chat box for questions about the results.
      </p>

      <div className={`mt-8 ${card}`}>
        <StatusPanel status={status} onRecheck={recheck} />
      </div>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold">Install in about 2 minutes</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Works in Chrome, Microsoft Edge and other Chromium browsers (Brave, Arc) on a computer.
          Browser extensions can't run on phones.
        </p>
        <ol className="mt-8 border-t border-[color:var(--color-hairline)]">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="grid gap-4 border-b border-[color:var(--color-hairline)] py-6 md:grid-cols-[4rem_1fr]"
            >
              <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <h3 className="text-lg font-medium">{s.title}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <a href={SAVANT_COACH_DOWNLOAD} download className={`inline-block ${primaryButton}`}>
            Download Savant Coach
          </a>
        </div>
      </section>

      <section className="mt-16 grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold">Using it</h2>
          <ul className="mt-6 space-y-3 text-sm leading-relaxed">
            <Point>
              Open a job listing and click the <strong>Savant Coach icon</strong> in your toolbar. A
              side panel opens with <Badge tone="good">PASS</Badge> or{" "}
              <Badge tone="bad">NO PASS</Badge>, the reasons, and what was checked. It follows you
              as you switch tabs.
            </Point>
            <Point>
              <strong>NO PASS</strong> means don't recommend it: the employer's hiring board no
              longer lists it, the page says it's closed or expired, it's an old or repeatedly
              reposted listing, or it asks applicants for money.
            </Point>
            <Point>
              <strong>PASS</strong> means no ghost signals were found. A <em>low confidence</em>{" "}
              pass means the page couldn't be read, so open it and check before you send it.
            </Point>
            <Point>
              Have a <strong>Google Sheet</strong> of listings? Open it and the panel finds the
              column of links, then <strong>Check all</strong> gives every row a Pass or No pass.
              Filter the results, open <em>Why</em> on any row, and <strong>Copy as table</strong>{" "}
              to paste the verdicts back into your sheet.
            </Point>
            <Point>
              Use the <strong>chat box</strong> to ask things like “why did row 4 fail?” or “which
              of these should I send to Maria?”. It answers from the results on screen.
            </Point>
            <Point>
              On a company's own careers site, the panel asks once per site for permission to read
              the page. Say yes only for sites you use.
            </Point>
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-semibold">What it never does</h2>
          <ul className="mt-6 space-y-3 text-sm leading-relaxed">
            <Point>
              <strong>Never changes a page.</strong> It only reads what's on the listing; it doesn't
              click, type or apply.
            </Point>
            <Point>
              <strong>Only reads when the panel is open</strong>, on the listing or sheet you're
              looking at, not the rest of your browsing.
            </Point>
            <Point>
              <strong>Isn't a guarantee.</strong> It's a second pair of eyes. A Pass doesn't promise
              the job is real, and a No pass is worth a look if you know the employer is hiring.
              Savant's team can mark a listing as real.
            </Point>
            <Point>
              Each check is logged for Savant's team, along with who ran it, so listings other
              coaches have already checked come back faster.
            </Point>
          </ul>
          <Link to="/coach/help" className={`mt-6 inline-block ${mutedButton}`}>
            Coach help →
          </Link>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold">Troubleshooting</h2>
        <dl className="mt-6 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)] text-sm">
          <Faq q="The panel says “Sign in to Savant”">
            Open this site in the same browser while signed in as a coach, or reload it. That hands
            your session to the extension.
          </Faq>
          <Faq q="It asks to “Allow Savant Coach on this site”">
            That's the browser's permission for a site the extension doesn't already know. Click the
            button once per site. It's only used while the panel is open.
          </Faq>
          <Faq q="“Can't read this sheet”">
            Make sure you're signed in to Google in this browser and can view the sheet. It reads
            the tab that's open, and only the text in the cells, so a link hidden behind a label
            isn't seen. Paste the links into the box instead, or show the full web address.
          </Faq>
          <Faq q="Chrome warns about developer-mode extensions">
            That's expected for extensions added with “Load unpacked”. Keep Savant Coach enabled;
            the reminder goes away once it's in the Chrome Web Store.
          </Faq>
          <Faq q="How do I update it?">
            Download the zip again, replace your <strong>savant-coach</strong> folder with the new
            one, then click the reload arrow on Savant Coach's card at{" "}
            <Code>chrome://extensions</Code>.
          </Faq>
          <Faq q="How do I remove it?">
            Go to <Code>chrome://extensions</Code> (or <Code>edge://extensions</Code>) and click{" "}
            <em>Remove</em> on Savant Coach. You can then delete the folder.
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
          {status.state === "checking" && "Checking for Savant Coach…"}
          {status.state === "installed" &&
            (status.connected
              ? `Savant Coach ${status.version} is installed and connected.`
              : `Savant Coach ${status.version} is installed. Reload this page to connect it.`)}
          {status.state === "missing" && "Savant Coach isn't installed yet."}
          {status.state === "unsupported" &&
            "This browser can't run Savant Coach. Use Chrome or Edge on a computer."}
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
