import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { label, linkButton } from "./ui";

/** A numbered workflow on a hub's Getting started page. */
export type GuideStep = {
  title: string;
  /** Where to do it, e.g. "Jobs" or "Talent Feed". */
  where?: string;
  body: ReactNode;
  links: { label: string; to: LinkProps["to"] }[];
};

export function GettingStarted({
  eyebrow,
  title,
  intro,
  steps,
  notes,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  steps: GuideStep[];
  notes?: { q: string; a: ReactNode }[];
}) {
  return (
    <section className="max-w-3xl">
      <p className={label}>{eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl font-semibold md:text-4xl">{title}</h1>
      <div className="mt-4 text-base leading-relaxed text-muted-foreground">{intro}</div>

      <ol className="mt-10 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-5 py-7">
            <span
              className="font-display text-2xl font-semibold text-muted-foreground"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-medium">
                {s.title}
                {s.where && (
                  <span className="ml-3 align-middle text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {s.where}
                  </span>
                )}
              </h2>
              <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
                {s.body}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {s.links.map((l) => (
                  <Link key={l.label} to={l.to} className={linkButton}>
                    {l.label} →
                  </Link>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {notes && notes.length > 0 && (
        <div className="mt-12">
          <h2 className={label}>Good to know</h2>
          <dl className="mt-4 space-y-5 text-sm leading-relaxed">
            {notes.map((n) => (
              <div key={n.q}>
                <dt className="font-medium">{n.q}</dt>
                <dd className="mt-1 text-muted-foreground">{n.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
