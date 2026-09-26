import { Link } from "@tanstack/react-router";
import { Badge, label, primaryButton } from "@/components/site/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  ACTIVITY_LABEL,
  TEMP_DATA_AS_OF,
  TEMP_PARTNERS,
  type ActivityLevel,
  type TempPartner,
} from "@/data/temp-partners";

const ACTIVITY_TONE: Record<ActivityLevel, "good" | "warn" | "muted"> = {
  high: "good",
  medium: "warn",
  low: "muted",
};

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 ? 2 : 0,
  });

/**
 * Temporary staffing through partner platforms. Shared by the informative
 * page (/temporary-staffing) and the talent page (/talent/temporary-work);
 * `withSignup` adds each platform's sign-up link.
 */
export function TempStaffingOverview({ withSignup = false }: { withSignup?: boolean }) {
  const { auth } = useAuth();
  return (
    <div>
      <nav className="flex flex-wrap gap-8 text-[12px] uppercase tracking-[0.2em] text-muted-foreground">
        {TEMP_PARTNERS.map((p) => (
          <a key={p.id} href={`#${p.id}`} className="[@media(hover:hover)]:hover:text-foreground">
            {p.name}
          </a>
        ))}
      </nav>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {TEMP_PARTNERS.map((p) => (
          <a
            key={p.id}
            href={`#${p.id}`}
            className="flex flex-col gap-4 rounded-sm border border-[color:var(--color-hairline)] p-6 transition-colors [@media(hover:hover)]:hover:border-foreground"
          >
            <PartnerMark partner={p} />
            <p className="text-sm text-muted-foreground">{p.tagline}</p>
            <div className="mt-auto text-xs text-muted-foreground">
              {p.positions.length
                ? `${p.positions.length} position type${p.positions.length === 1 ? "" : "s"}`
                : "Positions coming soon"}
            </div>
          </a>
        ))}
      </div>

      {TEMP_DATA_AS_OF && (
        <p className="mt-6 text-xs text-muted-foreground">
          Position and pay data as of {new Date(`${TEMP_DATA_AS_OF}T00:00:00`).toLocaleDateString()}
          . Availability changes daily on each platform.
        </p>
      )}

      {TEMP_PARTNERS.map((p) => (
        <section
          key={p.id}
          id={p.id}
          className="mt-20 scroll-mt-28 border-t border-[color:var(--color-hairline)] pt-14"
        >
          <div className="flex flex-wrap items-center justify-between gap-6">
            <PartnerMark partner={p} large />
            {withSignup && (
              <a
                href={p.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={primaryButton}
              >
                Sign up with {p.name} ↗
              </a>
            )}
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed">{p.tagline}</p>

          {p.howItWorks.length > 0 && (
            <div className="mt-8">
              <div className={label}>How it works</div>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                {p.howItWorks.map((h) => (
                  <li key={h} className="flex gap-3">
                    <span aria-hidden className="text-brass">
                      —
                    </span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-10">
            <div className={label}>Positions on {p.name}</div>
            {p.positions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Position types, companies and pay ranges coming soon.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
                  <thead>
                    <tr className="border-b border-[color:var(--color-hairline)] text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      <th className="py-3 font-normal">Position type</th>
                      <th className="py-3 font-normal">Active companies</th>
                      <th className="py-3 font-normal">Activity</th>
                      <th className="py-3 text-right font-normal">Pay range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.positions.map((pos) => (
                      <tr
                        key={pos.title}
                        className="border-b border-[color:var(--color-hairline)] align-top"
                      >
                        <td className="py-4 font-medium">{pos.title}</td>
                        <td className="py-4 text-muted-foreground">
                          {pos.companies.join(", ") || "—"}
                        </td>
                        <td className="py-4">
                          <Badge tone={ACTIVITY_TONE[pos.activity]}>
                            {ACTIVITY_LABEL[pos.activity]}
                          </Badge>
                        </td>
                        <td className="py-4 text-right tabular-nums">
                          {usd(pos.payMin)}–{usd(pos.payMax)}/hr
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ))}

      {withSignup ? (
        <p className="mt-16 max-w-2xl text-xs text-muted-foreground">
          Each sign-up opens that platform's own site, where you create your worker account and
          complete their onboarding. Shifts are booked and paid through the platform.
        </p>
      ) : auth?.role === "talent" ? (
        <div className="mt-16">
          <Link
            to="/talent/temporary-work"
            className="text-[12px] uppercase tracking-[0.2em] underline underline-offset-4"
          >
            Sign up with a platform from your talent hub →
          </Link>
        </div>
      ) : auth ? null : (
        <div className="mt-16 flex flex-wrap items-center gap-6 border border-[color:var(--color-hairline)] p-8">
          <p className="max-w-xl text-sm text-muted-foreground">
            Talent accounts get direct sign-up links for each platform from their Savant dashboard.
          </p>
          <Link
            to="/auth"
            search={{ mode: "signup" } as never}
            className="text-[12px] uppercase tracking-[0.2em] underline underline-offset-4"
          >
            Create a talent account
          </Link>
        </div>
      )}
    </div>
  );
}

function PartnerMark({ partner, large = false }: { partner: TempPartner; large?: boolean }) {
  return partner.logo ? (
    <img
      src={partner.logo}
      alt={partner.name}
      className={large ? "h-10 w-auto" : "h-7 w-auto"}
      loading="lazy"
    />
  ) : (
    <span className={large ? "text-3xl font-semibold md:text-4xl" : "text-xl font-semibold"}>
      {partner.name}
    </span>
  );
}
