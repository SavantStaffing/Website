import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ChipGroup, label, list, mutedButton, primaryButton } from "@/components/site/ui";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import {
  TIERS,
  employerAnchor,
  type RatedEmployer,
  type Tier,
} from "@/lib/ratings/employer-rating";
import { useEmployerRatings } from "@/lib/ratings/use-employer-ratings";

// Ratings are for signed-in users of any role. Guests see what the ratings
// are and how they work, with a sign-up prompt in place of the list; the data
// itself is locked to signed-in users (employer_rating_inputs()).
export const Route = createFileRoute("/employer-ratings")({
  head: () => ({
    meta: [
      { title: "Employer Ratings — Savant Staffing" },
      {
        name: "description",
        content:
          "How the employers hiring through Savant treat their people: one rating combining fair pay, conduct, inclusion and labor-law records from independent sources.",
      },
    ],
  }),
  component: EmployerRatings,
});

const PAGE = 40;

function EmployerRatings() {
  const { auth, loading } = useAuth();
  const { index, error } = useEmployerRatings();
  const [scope, setScope] = useState<"hiring" | "all">("hiring");
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  // Arriving from a job listing (#company-key): widen the list and open that employer.
  useEffect(() => {
    if (!index) return;
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (!hash) return;
    const hit = [...index.values()].find((e) => employerAnchor(e.key) === hash);
    if (!hit) return;
    if (!hit.openJobs) setScope("all");
    setOpen(hit.key);
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "center" }));
  }, [index]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...(index?.values() ?? [])].filter(
      (e) =>
        e.rating &&
        (scope === "all" || e.openJobs > 0) &&
        (!tiers.length || tiers.includes(e.rating.tier)) &&
        (!needle || e.name.toLowerCase().includes(needle)),
    );
  }, [index, scope, tiers, q]);

  const unrated = useMemo(
    () => [...(index?.values() ?? [])].filter((e) => !e.rating && e.openJobs > 0),
    [index],
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
        Employer Ratings
      </p>
      <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">
        Know who you'd be working for.
      </h1>
      <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
        One rating per employer, combining independent benchmarks of pay and worker treatment,
        corporate conduct and inclusion with U.S. Department of Labor records. No employer pays to
        be rated, and none can change its score.
      </p>

      <div className="mt-12 grid gap-px overflow-hidden rounded-sm border border-[color:var(--color-hairline)] bg-[color:var(--color-hairline)] sm:grid-cols-5">
        {TIERS.map((t, i) => (
          <div key={t.tier} className="bg-background p-4">
            <RatingBadge tier={t.tier} />
            <div className="mt-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              {i === 0 ? `${t.min}–100` : `${t.min}–${TIERS[i - 1].min - 1}`}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.blurb}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="mt-12 text-sm text-muted-foreground">Loading…</p>
      ) : !auth ? (
        <SignUpToView />
      ) : (
        <>
          <div className="mt-12 flex flex-wrap items-end justify-between gap-6 border-b border-[color:var(--color-hairline)] pb-6">
            <div className="flex flex-wrap items-end gap-6">
              <label className="block">
                <span className={label}>Show</span>
                <select
                  value={scope}
                  onChange={(e) => {
                    setScope(e.target.value as "hiring" | "all");
                    setShown(PAGE);
                  }}
                  className="mt-2 block border-b border-foreground bg-transparent py-2 text-lg font-medium outline-none"
                >
                  <option value="hiring">Hiring on Savant</option>
                  <option value="all">All rated companies</option>
                </select>
              </label>
              <label className="block">
                <span className={label}>Search</span>
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setShown(PAGE);
                  }}
                  placeholder="Company name"
                  className="mt-2 block w-56 border-b border-foreground bg-transparent py-2 text-lg outline-none"
                />
              </label>
            </div>
            <ChipGroup
              options={TIERS.map((t) => ({ value: t.tier, label: t.tier }))}
              value={tiers}
              onChange={(v) => {
                setTiers(v);
                setShown(PAGE);
              }}
            />
          </div>

          {error ? (
            <p className="mt-8 text-sm text-muted-foreground">
              Ratings aren't available right now. Please try again shortly.
            </p>
          ) : !index ? (
            <p className="mt-8 text-sm text-muted-foreground">Loading ratings…</p>
          ) : rows.length === 0 ? (
            <p className="mt-8 text-sm text-muted-foreground">
              No rated employers match.
              {scope === "hiring" && (
                <>
                  {" "}
                  <button onClick={() => setScope("all")} className="underline underline-offset-4">
                    Show all rated companies
                  </button>
                </>
              )}
            </p>
          ) : (
            <>
              <p className="mt-6 text-xs text-muted-foreground">
                {rows.length} rated employer{rows.length === 1 ? "" : "s"}, best first.
              </p>
              <ol className={`mt-4 ${list}`}>
                {rows.slice(0, shown).map((e, i) => (
                  <EmployerRow
                    key={e.key}
                    e={e}
                    position={i + 1}
                    open={open === e.key}
                    onToggle={() => setOpen(open === e.key ? null : e.key)}
                  />
                ))}
              </ol>
              {rows.length > shown && (
                <button onClick={() => setShown(shown + PAGE)} className={`mt-6 ${mutedButton}`}>
                  Show more ({rows.length - shown} left)
                </button>
              )}
            </>
          )}

          {scope === "hiring" && unrated.length > 0 && (
            <p className="mt-8 text-xs text-muted-foreground">
              Not yet rated (no independent data found): {unrated.map((e) => e.name).join(", ")}.
            </p>
          )}
        </>
      )}

      <Methodology />
    </div>
  );
}

function EmployerRow({
  e,
  position,
  open,
  onToggle,
}: {
  e: RatedEmployer;
  position: number;
  open: boolean;
  onToggle: () => void;
}) {
  const r = e.rating!;
  return (
    <li id={employerAnchor(e.key)} className="scroll-mt-24 py-5">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 text-left"
      >
        <span className="w-8 text-sm tabular-nums text-muted-foreground">{position}</span>
        <span className="min-w-0 flex-1 text-lg font-medium">{e.name}</span>
        <RatingBadge tier={r.tier} score={r.score} />
        <span className="w-36 whitespace-nowrap text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          {r.confidence} confidence
        </span>
        <span className="w-28 whitespace-nowrap text-right text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          {e.openJobs ? `${e.openJobs} open job${e.openJobs === 1 ? "" : "s"}` : "—"}
        </span>
      </button>

      {open && (
        <div className="mt-5 grid gap-8 pl-14 md:grid-cols-2">
          <div>
            <div className={label}>What goes into it</div>
            <ul className="mt-3 space-y-3">
              {r.components.map((c) => (
                <li key={c.key}>
                  <div className="flex justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="tabular-nums">{Math.round(c.value)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[color:var(--color-hairline)]">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${c.value}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {c.detail} · weight {c.weight}
                  </div>
                </li>
              ))}
            </ul>
            {r.penalties.length > 0 && (
              <p className="mt-4 text-sm text-red-700 dark:text-red-400">
                Labor record: {r.penalties.map((p) => `${p.label} (−${p.points})`).join(", ")}
              </p>
            )}
          </div>
          <div className="space-y-4 text-sm">
            {r.highlights.length > 0 && (
              <div>
                <div className={label}>Strengths</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {r.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {r.concerns.length > 0 && (
              <div>
                <div className={label}>Concerns</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {r.concerns.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {r.confidence === "High"
                ? "Backed by most of our sources."
                : r.confidence === "Medium"
                  ? "Based on some of our sources; treat as a good indication."
                  : "Based on limited data; treat as a first look."}
            </p>
            {e.openJobs > 0 && (
              <Link to="/jobs" className={mutedButton}>
                Browse jobs →
              </Link>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/** Shown to guests in place of the ratings list. The preview rows are placeholders, not data. */
function SignUpToView() {
  const preview: [Tier, number][] = [
    ["Exemplary", 86],
    ["Strong", 74],
    ["Strong", 68],
    ["Fair", 57],
  ];
  return (
    <section className="relative mt-12 overflow-hidden rounded-sm border border-[color:var(--color-hairline)]">
      <ol aria-hidden className={`pointer-events-none select-none blur-[5px] ${list}`}>
        {preview.map(([tier, score], i) => (
          <li key={i} className="flex items-center gap-6 px-6 py-5">
            <span className="w-8 text-sm text-muted-foreground">{i + 1}</span>
            <span className="h-4 flex-1 rounded-sm bg-[color:var(--color-hairline)]" />
            <RatingBadge tier={tier} score={score} />
            <span className="w-24 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              {12 - i * 3} open jobs
            </span>
          </li>
        ))}
      </ol>
      <div className="absolute inset-0 flex items-center justify-center bg-background/70 p-6">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-semibold">Sign up to view employer ratings</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            See how every employer hiring through Savant scores on pay, conduct, inclusion and
            labor-law record, before you apply. Free for job seekers and employers.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-5">
            <Link
              to="/auth"
              search={{ mode: "signup", next: "/employer-ratings" } as never}
              className={primaryButton}
            >
              Sign up free
            </Link>
            <Link
              to="/auth"
              search={{ mode: "login", next: "/employer-ratings" } as never}
              className={mutedButton}
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Methodology() {
  return (
    <section className="mt-24 border-t border-[color:var(--color-hairline)] pt-12">
      <h2 className="text-2xl font-semibold">How the rating works</h2>
      <div className="mt-6 grid gap-10 text-sm leading-relaxed text-muted-foreground md:grid-cols-2">
        <div className="space-y-4">
          <p>
            Each employer gets a score from 0 to 100: the weighted average of whichever of these
            measures it has. A missing measure is left out rather than counted against the employer.
          </p>
          <table className="w-full text-left">
            <tbody className="divide-y divide-[color:var(--color-hairline)]">
              {[
                ["Fair pay & worker respect", "World Benchmarking Alliance", "25"],
                ["Corporate conduct (rank → percentile)", "JUST Capital", "30"],
                ["Diversity & inclusion", "As You Sow", "25"],
                ["Cultures & communities", "World Benchmarking Alliance", "10"],
                ["Honest & fair business", "World Benchmarking Alliance", "10"],
              ].map(([m, s, w]) => (
                <tr key={m}>
                  <td className="py-2 pr-4 text-foreground">{m}</td>
                  <td className="py-2 pr-4">{s}</td>
                  <td className="py-2 text-right tabular-nums">{w}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          <p>
            Points come off for the employer's record at Bay Area sites over the last five years
            (U.S. Department of Labor): 4 per wage-and-hour case (up to 16), 8 for a repeat wage
            violator, and 2 per serious OSHA safety violation (up to 12).
          </p>
          <p>
            Confidence shows how much of the rating is backed by data: High when most measures are
            available, Low when it rests on a single source. A Low-confidence employer is never
            rated above Strong.
          </p>
          <p className="text-xs">
            Sources: World Benchmarking Alliance Social Benchmark via{" "}
            <a
              href="https://wikirate.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Wikirate.org
            </a>{" "}
            (CC BY 4.0); JUST Capital rankings; As You Sow workplace DEI scores; U.S. Department of
            Labor enforcement data. Savant computes the combined rating; the sources don't endorse
            it.
          </p>
        </div>
      </div>
    </section>
  );
}
