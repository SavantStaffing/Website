import type { EmployerRating, Tier } from "@/lib/ratings/employer-rating";
import { CONFIDENCE_INFO, TIER_RANGES } from "@/lib/ratings/score-info";
import { ScoreInfo } from "./ScoreInfo";

const TONE: Record<Tier, string> = {
  Exemplary: "border-emerald-600/50 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
  Strong: "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
  Fair: "border-[color:var(--color-hairline)] text-foreground",
  Mixed: "border-amber-600/40 text-amber-700 dark:text-amber-400",
  Concerning: "border-red-600/40 text-red-700 dark:text-red-400",
};

/**
 * "Strong · 72" pill in the tier's colour; just the tier when no score is
 * given. Hover/tap explains the rating: pass `rating` for the employer's own
 * breakdown, or nothing for what the tier means.
 */
export function RatingBadge({
  tier,
  score,
  rating,
}: {
  tier: Tier;
  score?: number;
  rating?: Pick<EmployerRating, "confidence" | "components" | "penalties">;
}) {
  const range = TIER_RANGES.find((t) => t.tier === tier)!;
  return (
    <ScoreInfo
      info="savant"
      label={`the ${tier} rating`}
      underline={false}
      value={score !== undefined ? `${score}/100` : undefined}
      body={
        <div className="space-y-2">
          <p>
            <span className="font-medium">{tier}</span>{" "}
            <span className="text-muted-foreground">({range.range})</span> — {range.blurb}
          </p>
          {rating && (
            <>
              <p className="text-muted-foreground">
                <span className="text-foreground">{rating.confidence} confidence.</span>{" "}
                {CONFIDENCE_INFO[rating.confidence]}
              </p>
              {rating.components.length > 0 && (
                <ul className="space-y-0.5 border-t border-[color:var(--color-hairline)] pt-2">
                  {rating.components.map((c) => (
                    <li key={c.key} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="tabular-nums">{Math.round(c.value)}</span>
                    </li>
                  ))}
                  {rating.penalties.map((p) => (
                    <li
                      key={p.label}
                      className="flex justify-between gap-3 text-red-700 dark:text-red-400"
                    >
                      <span>{p.label}</span>
                      <span className="tabular-nums">−{p.points}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <div className="border-t border-[color:var(--color-hairline)] pt-2">
            <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Tiers
            </p>
            <TierScale current={tier} />
          </div>
        </div>
      }
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] ${TONE[tier]}`}
      >
        <span className="font-semibold">{tier}</span>
        {score !== undefined && (
          <>
            <span aria-hidden>·</span>
            <span>{score}</span>
          </>
        )}
      </span>
    </ScoreInfo>
  );
}

/** The five tiers and their score ranges, with this employer's tier marked. */
function TierScale({ current }: { current: Tier }) {
  return (
    <ul className="space-y-0.5">
      {TIER_RANGES.map((t) => (
        <li
          key={t.tier}
          className={`flex justify-between gap-3 ${t.tier === current ? "font-medium" : "text-muted-foreground"}`}
        >
          <span>
            {t.tier === current ? "▸ " : ""}
            {t.tier}
          </span>
          <span className="tabular-nums">{t.range}</span>
        </li>
      ))}
    </ul>
  );
}
