import type { Tier } from "@/lib/ratings/employer-rating";

const TONE: Record<Tier, string> = {
  Exemplary: "border-emerald-600/50 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
  Strong: "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
  Fair: "border-[color:var(--color-hairline)] text-foreground",
  Mixed: "border-amber-600/40 text-amber-700 dark:text-amber-400",
  Concerning: "border-red-600/40 text-red-700 dark:text-red-400",
};

/** "Strong · 72" pill in the tier's colour; just the tier when no score is given. */
export function RatingBadge({ tier, score }: { tier: Tier; score?: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] ${TONE[tier]}`}
      title="Savant Employer Rating (0–100)"
    >
      <span className="font-semibold">{tier}</span>
      {score !== undefined && (
        <>
          <span aria-hidden>·</span>
          <span>{score}</span>
        </>
      )}
    </span>
  );
}
