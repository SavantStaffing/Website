import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { card, label, linkButton, list, mutedButton, primaryButton } from "@/components/site/ui";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { COMPONENT_INFO, CONFIDENCE_INFO, SCORE_INFO } from "@/lib/ratings/score-info";
import {
  TIERS,
  employerAnchor,
  employerBySlug,
  type RatedEmployer,
} from "@/lib/ratings/employer-rating";
import { useEmployerRatings } from "@/lib/ratings/use-employer-ratings";

// One employer's rating in depth. Like the list, the data is for signed-in
// users only (employer_rating_inputs()), so it loads in the browser.
export const Route = createFileRoute("/employer-ratings_/$employer")({
  head: () => ({
    meta: [
      { title: "Employer rating — Savant Staffing" },
      {
        name: "description",
        content:
          "How one employer scores on fair pay, conduct, inclusion and labor-law record, measure by measure.",
      },
    ],
  }),
  component: EmployerPage,
});

const back =
  "text-[11px] uppercase tracking-[0.3em] text-muted-foreground [@media(hover:hover)]:hover:text-foreground";
const one = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

function EmployerPage() {
  const { employer: slug } = Route.useParams();
  const { auth, loading } = useAuth();
  const { index, error } = useEmployerRatings();
  const e = index ? employerBySlug(index, slug) : null;

  useEffect(() => {
    if (e) document.title = `${e.name} employer rating — Savant Staffing`;
  }, [e]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-24 lg:px-10 lg:py-32">
      <Link to="/employer-ratings" className={back}>
        ← Employer Ratings
      </Link>
      {loading ? (
        <p className="mt-12 text-sm text-muted-foreground">Loading…</p>
      ) : !auth ? (
        <Notice title="Sign up to view this employer's rating">
          <p>
            See how every employer hiring through Savant scores on pay, conduct, inclusion and
            labor-law record, before you apply. Free for job seekers and employers.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <Link
              to="/auth"
              search={{ mode: "signup", next: `/employer-ratings/${slug}` } as never}
              className={primaryButton}
            >
              Sign up free
            </Link>
            <Link
              to="/auth"
              search={{ mode: "login", next: `/employer-ratings/${slug}` } as never}
              className={mutedButton}
            >
              Log in
            </Link>
          </div>
        </Notice>
      ) : error ? (
        <Notice title="Ratings aren't available right now">
          <p>Please try again shortly.</p>
        </Notice>
      ) : !index ? (
        <p className="mt-12 text-sm text-muted-foreground">Loading rating…</p>
      ) : !e ? (
        <Notice title="We don't have this employer">
          <p>It may be listed under a different name.</p>
          <Link to="/employer-ratings" className={`mt-6 inline-block ${linkButton}`}>
            Search all employers →
          </Link>
        </Notice>
      ) : !e.rating ? (
        <Notice title={e.name}>
          <p>
            Not yet rated: we don't have enough independent data on this employer yet. It needs JUST
            Capital or As You Sow coverage, or at least two of the World Benchmarking Alliance,
            Where You Work Matters and its Department of Labor record. That says nothing about how
            good or bad it is.
          </p>
          {e.openJobs > 0 && (
            <Link to="/jobs" className={`mt-6 inline-block ${linkButton}`}>
              Browse jobs →
            </Link>
          )}
        </Notice>
      ) : (
        <Breakdown e={e} index={index} />
      )}
    </div>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-10 max-w-xl">
      <h1 className="text-4xl font-semibold leading-tight md:text-5xl">{title}</h1>
      <div className="mt-6 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-16 border-t border-[color:var(--color-hairline)] pt-10">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Breakdown({ e, index }: { e: RatedEmployer; index: Map<string, RatedEmployer> }) {
  const r = e.rating!;
  const rated = useMemo(() => [...index.values()].filter((x) => x.rating), [index]);
  const tier = TIERS.find((t) => t.tier === r.tier)!;
  const weight = r.components.reduce((s, c) => s + c.weight, 0);
  const deducted = r.penalties.reduce((s, p) => s + p.points, 0);

  /** How this employer's value on one measure compares with every other rated employer that has it. */
  const standing = (key: string, value: number) => {
    const peers = rated
      .filter((x) => x.key !== e.key)
      .map((x) => x.rating!.components.find((c) => c.key === key)?.value)
      .filter((v): v is number => v !== undefined)
      .sort((a, b) => a - b);
    if (peers.length < 5) return null;
    return {
      n: peers.length,
      median: peers[Math.floor(peers.length / 2)],
      below: Math.round((peers.filter((v) => v < value).length / peers.length) * 100),
    };
  };

  const at = rated.indexOf(e);
  const neighbours = rated.slice(Math.max(0, at - 2), at + 3);

  return (
    <>
      <p className="mt-10 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
        Employer Rating
      </p>
      <h1 className="mt-4 text-5xl font-semibold leading-tight md:text-6xl">{e.name}</h1>

      <div className="mt-10 grid gap-px overflow-hidden rounded-sm border border-[color:var(--color-hairline)] bg-[color:var(--color-hairline)] sm:grid-cols-4">
        <Stat title="Savant rating">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums">{r.score}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <div className="mt-2">
            <RatingBadge tier={r.tier} />
          </div>
        </Stat>
        <Stat title="Confidence">
          <div className="text-2xl font-semibold">{r.confidence}</div>
          <p className="mt-2 text-xs text-muted-foreground">
            {r.sources.length} source{r.sources.length === 1 ? "" : "s"}: {r.sources.join(", ")}.
          </p>
        </Stat>
        <Stat title="Rank">
          <div className="text-2xl font-semibold tabular-nums">
            #{e.overallRank}{" "}
            <span className="text-sm font-normal text-muted-foreground">of {rated.length}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {e.hiringRank
              ? `#${e.hiringRank} among employers hiring on Savant.`
              : "Among all rated employers."}
          </p>
        </Stat>
        <Stat title="Open jobs">
          <div className="text-2xl font-semibold tabular-nums">{e.openJobs || "—"}</div>
          {e.openJobs > 0 ? (
            <Link to="/jobs" className={`mt-2 inline-block ${linkButton}`}>
              Browse jobs →
            </Link>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Not hiring on Savant right now.</p>
          )}
        </Stat>
      </div>

      <p className="mt-8 max-w-2xl text-base leading-relaxed">
        <span className="font-medium">{r.tier}.</span>{" "}
        <span className="text-muted-foreground">
          {tier.blurb} {CONFIDENCE_INFO[r.confidence]}
        </span>
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {r.confidenceNote}
      </p>

      {(r.highlights.length > 0 || r.concerns.length > 0) && (
        <div className="mt-10 grid gap-8 text-sm md:grid-cols-2">
          {r.highlights.length > 0 && (
            <div>
              <div className={label}>Strengths</div>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {r.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {r.concerns.length > 0 && (
            <div>
              <div className={label}>Concerns</div>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {r.concerns.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Section title="How the score adds up">
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {r.route === "adaptive"
            ? "JUST Capital and As You Sow don't cover this employer, so it's rated from the World Benchmarking Alliance, Where You Work Matters and its labor record: the ones it has share the 100 points equally (50 each with two sources, 33.3 each with three). Measures without data are left out, not counted as zero."
            : "The score is the weighted average of the measures this employer has data for, minus any points for its labor record. Measures without data are left out, not counted as zero."}
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead className={label}>
              <tr>
                <th className="pb-3 pr-4 font-normal">Measure</th>
                <th className="pb-3 pr-4 text-right font-normal">Score</th>
                <th className="pb-3 pr-4 text-right font-normal">Share</th>
                <th className="pb-3 text-right font-normal">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)] tabular-nums">
              {r.components.map((c) => (
                <tr key={c.key}>
                  <td className="py-3 pr-4">{c.label}</td>
                  <td className="py-3 pr-4 text-right">{Math.round(c.value)}</td>
                  <td className="py-3 pr-4 text-right text-muted-foreground">
                    {Math.round((c.weight / weight) * 100)}%
                  </td>
                  <td className="py-3 text-right">{one((c.value * c.weight) / weight)}</td>
                </tr>
              ))}
              {r.missing.map((m) => (
                <tr key={m.key} className="text-muted-foreground">
                  <td className="py-3 pr-4">{m.label}</td>
                  <td className="py-3 pr-4 text-right">no data</td>
                  <td className="py-3 pr-4 text-right">left out</td>
                  <td className="py-3 text-right">—</td>
                </tr>
              ))}
              <tr>
                <td className="py-3 pr-4 font-medium" colSpan={3}>
                  Weighted average
                </td>
                <td className="py-3 text-right font-medium">{one(r.base)}</td>
              </tr>
              {r.penalties.map((p) => (
                <tr key={p.label} className="text-red-700 dark:text-red-400">
                  <td className="py-3 pr-4" colSpan={3}>
                    Labor record: {p.label}
                  </td>
                  <td className="py-3 text-right">−{p.points}</td>
                </tr>
              ))}
              <tr>
                <td className="py-3 pr-4 text-base font-semibold" colSpan={3}>
                  Savant rating
                </td>
                <td className="py-3 text-right text-base font-semibold">{r.score}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Share is each measure's weight among the measures this employer has. Points are score ×
          share.
          {deducted > 0 &&
            ` ${deducted} point${deducted === 1 ? "" : "s"} came off for the labor record.`}
          {r.capped &&
            " The score is in the Exemplary range, but with Low confidence the tier is held at Strong."}
        </p>
      </Section>

      <Section title="Measure by measure">
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {r.components.map((c) => {
            const info = SCORE_INFO[COMPONENT_INFO[c.key]];
            const s = standing(c.key, c.value);
            const wba = ["fair_pay", "cultures", "honest", "wba"].includes(c.key);
            return (
              <div key={c.key} className={card}>
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-base font-semibold">{info?.title ?? c.label}</h3>
                  <span className="text-2xl font-semibold tabular-nums">{Math.round(c.value)}</span>
                </div>
                <div className="relative mt-4 h-1.5 rounded-full bg-[color:var(--color-hairline)]">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${c.value}%` }}
                  />
                  {s && (
                    <div
                      aria-hidden
                      className="absolute -top-1 h-3.5 w-px bg-[color:var(--color-brass)]"
                      style={{ left: `${s.median}%` }}
                    />
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {s
                    ? `Higher than ${s.below}% of the ${s.n} other rated employers with this measure (median ${Math.round(s.median)}, marked).`
                    : "Too few other employers have this measure to compare."}
                </p>
                {info && (
                  <>
                    <p className="mt-4 text-sm leading-relaxed">{info.what}</p>
                    {"scale" in info && (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {info.scale}
                      </p>
                    )}
                  </>
                )}
                <p className="mt-4 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  {c.detail}
                  {wba && e.wbaYear ? ` · ${e.wbaYear} assessment` : ""}
                  {info && "source" in info && (
                    <>
                      {" · "}
                      <a
                        href={info.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        Source
                      </a>
                    </>
                  )}
                </p>
              </div>
            );
          })}
        </div>
        {r.missing.length > 0 && (
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            No data for: {r.missing.map((m) => `${m.label} (weight ${m.weight})`).join(", ")}. These
            sources don't cover this employer, which lowers confidence but not the score.
          </p>
        )}
      </Section>

      <Section title="Labor record">
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {SCORE_INFO.labor_record.what}{" "}
          {r.route === "adaptive" ? SCORE_INFO.labor.scale : SCORE_INFO.labor_record.scale}
        </p>
        {!r.laborChecked ? (
          <p className="mt-4 text-sm">
            We haven't checked this employer's Department of Labor record yet, so nothing has been
            deducted.
          </p>
        ) : r.laborFindings.length === 0 ? (
          <p className="mt-4 text-sm">
            Clean: no wage-and-hour cases or serious safety violations on record at its Bay Area
            sites in the last five years.
          </p>
        ) : (
          <ul className={`mt-6 text-sm ${list}`}>
            {r.laborFindings.map((p) => (
              <li key={p.label} className="flex justify-between gap-4 py-3">
                <span>{p.label}</span>
                <span className="tabular-nums text-red-700 dark:text-red-400">−{p.points}</span>
              </li>
            ))}
          </ul>
        )}
        <a
          href={SCORE_INFO.labor_record.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-4 inline-block ${mutedButton}`}
        >
          U.S. Department of Labor enforcement data →
        </a>
      </Section>

      <Section title="Where it stands">
        <ol className={`mt-6 ${list}`}>
          {neighbours.map((n) => (
            <li
              key={n.key}
              className={`flex flex-wrap items-center gap-x-6 gap-y-2 py-4 ${n.key === e.key ? "font-semibold" : ""}`}
            >
              <span className="w-10 text-sm tabular-nums text-muted-foreground">
                {n.overallRank}
              </span>
              <span className="min-w-0 flex-1">
                {n.key === e.key ? (
                  n.name
                ) : (
                  <Link
                    to="/employer-ratings/$employer"
                    params={{ employer: employerAnchor(n.key) }}
                    className="underline decoration-[color:var(--color-hairline)] underline-offset-4 [@media(hover:hover)]:hover:decoration-foreground"
                  >
                    {n.name}
                  </Link>
                )}
              </span>
              <RatingBadge tier={n.rating!.tier} score={n.rating!.score} />
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          Ranked by tier, then score, among all {rated.length} rated employers.
        </p>
        <Link to="/employer-ratings" className={`mt-6 inline-block ${linkButton}`}>
          All employer ratings and method →
        </Link>
      </Section>
    </>
  );
}

function Stat({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-background p-5">
      <div className={label}>{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
