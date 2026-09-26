import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — Savant Staffing" },
      { name: "description", content: "Staffing services offered by Savant Staffing." },
    ],
  }),
  component: Services,
});

const SERVICES = [
  { name: "Temporary Staffing", tag: "Flexible coverage, fast", to: "/temporary-staffing" },
  { name: "Professional Roles", tag: "Full-time placements" },
  {
    name: "Preparation",
    tag: "Career programs, resume building & interview development",
    to: "/preparation",
  },
] as const;

/**
 * Public explanation of the matching pipeline. Keep in step with the code:
 * equity → src/lib/scout/ratings.ts (cutoffs are editable on /admin/ratings),
 * ghost → src/lib/scout/ghost.ts, preferences → src/lib/scout/rank.ts.
 */
const LAYERS = [
  {
    id: "equity-filter",
    title: "Equity filter",
    lede: "Before we list an employer's roles, we check how that employer treats people.",
    checks: [
      "Each company is checked against JUST Capital's rankings of America's most just companies, which weigh worker pay, benefits, advancement, and treatment of communities. Companies must rank in the top 50 to pass.",
      "Each company is also checked against As You Sow's workplace diversity, equity and inclusion scores. Companies must score at least 40% to pass.",
      "A company on both lists has to pass both. A company that falls short on a list it appears on doesn't reach our job feed, and any of its roles already listed are taken down.",
      "Employers that pass carry a badge on every role, so you can see why they're there.",
    ],
    why: "A job is more than a title and a salary — it's the place you'll spend most of your week. Independent ratings of how an employer pays, promotes, and includes its people are the best early signal of what working there is actually like. We'd rather send you to fewer employers who have earned it than to every employer who happens to be hiring.",
  },
  {
    id: "ghost-filter",
    title: "Ghost filter",
    lede: "We screen out postings that exist without a real intent to hire.",
    checks: [
      "How long a role has been open — postings that sit for months, or over a year, are held back.",
      "Reposts — the same role at the same company and location relisted under new IDs.",
      "“Talent pool”, “future opportunities” and other evergreen language that signals a pipeline rather than an opening.",
      "Vague titles, missing or very thin descriptions, and missing locations.",
      "Scam markers, such as asking applicants to pay for training, send banking details, or cover a processing fee.",
      "We re-check roles against the employer's own careers site and close them once they come down.",
    ],
    why: "Ghost jobs cost you the most expensive thing in a search: time. Every application to a role that was never going to be filled is an hour of tailoring and a week of waiting for a reply that doesn't come. Held-back postings go to our team for review, so a real role that looks stale can still be restored — but you only see the ones worth your effort.",
  },
  {
    id: "preference-layer",
    title: "Preference layer",
    lede: "What's left is ranked for you — not for the average applicant.",
    checks: [
      "Positions you're targeting, matched against each role's title.",
      "Industries, down to NAICS sector, so a logistics specialist sees logistics roles first.",
      "Locations you'll work in, and whether you're open to remote.",
      "Schedule — full time, part time, temporary, contract or internship.",
      "How recently a role was posted, over the window you choose.",
      "Every match shows its reasons, and filters let you narrow further at any moment.",
    ],
    why: "Two people searching for the same job title rarely want the same job. Ranking on your own priorities puts the roles that actually fit your life at the top of the list, and tells you why each one is there so you can trust it or change it.",
  },
] as const;

function Services() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Services</p>
      <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">How we staff.</h1>
      <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
        We personalize the journey for every person we work with. Our approach is holistic and built
        around understanding you. We take the time to learn your goals, strengths, experience, and
        what you're looking for in your next opportunity. From there, we work directly with
        employers to identify roles where your skills and aspirations align, while supporting you
        through every stage of the process—from refining your résumé and preparing for interviews to
        positioning you for long-term success.
      </p>

      <ul className="mt-16 border-t border-[color:var(--color-hairline)]">
        {SERVICES.map((s) => {
          const body = (
            <div>
              <div className="text-3xl font-medium md:text-4xl">{s.name}</div>
              <div className="mt-3 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                {s.tag}
              </div>
            </div>
          );
          return (
            <li key={s.name} className="border-b border-[color:var(--color-hairline)]">
              {"to" in s ? (
                <Link
                  to={s.to}
                  className="group flex flex-wrap items-baseline justify-between gap-6 py-10 transition-colors [@media(hover:hover)]:hover:bg-black/[0.02] active:bg-black/[0.03]"
                >
                  {body}
                  <div className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-muted-foreground [@media(hover:hover)]:group-hover:text-foreground group-active:text-foreground">
                    Learn more →
                  </div>
                </Link>
              ) : (
                <div className="py-10">{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      <section className="mt-32">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">How we match</p>
        <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
          Three layers between you and every listing.
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Every role in the Savant job feed has passed through the same three layers, in order.
        </p>
        <nav className="mt-10 flex flex-wrap gap-8 text-[12px] uppercase tracking-[0.2em] text-muted-foreground">
          {LAYERS.map((l) => (
            <a key={l.id} href={`#${l.id}`} className="[@media(hover:hover)]:hover:text-foreground">
              {l.title}
            </a>
          ))}
        </nav>

        <ol className="mt-16 border-t border-[color:var(--color-hairline)]">
          {LAYERS.map((l, i) => (
            <li
              key={l.id}
              id={l.id}
              className="grid scroll-mt-28 gap-8 border-b border-[color:var(--color-hairline)] py-16 md:grid-cols-[6rem_1fr]"
            >
              <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <h3 className="text-3xl font-semibold md:text-4xl">{l.title}</h3>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed">{l.lede}</p>

                <div className="mt-10 grid gap-10 lg:grid-cols-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                      What it checks
                    </div>
                    <ul className="mt-4 space-y-3 text-sm leading-relaxed">
                      {l.checks.map((c) => (
                        <li key={c} className="flex gap-3">
                          <span aria-hidden className="text-brass">
                            —
                          </span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                      Why it matters
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{l.why}</p>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-wrap gap-6 text-[12px] uppercase tracking-[0.2em]">
          <Link
            to="/jobs"
            className="border-b border-foreground pb-1 [@media(hover:hover)]:hover:text-muted-foreground"
          >
            Browse jobs
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" } as never}
            className="border-b border-muted-foreground pb-1 text-muted-foreground [@media(hover:hover)]:hover:border-foreground [@media(hover:hover)]:hover:text-foreground"
          >
            Set your preferences
          </Link>
        </div>
      </section>
    </div>
  );
}
