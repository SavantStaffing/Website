import { Link } from "@tanstack/react-router";
import savantLogo from "@/assets/savant-logo.png";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-[color:var(--color-hairline)]">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="grid gap-16 md:grid-cols-2 md:gap-24">
          <div>
            <img src={savantLogo} alt="Savant" className="h-6 w-auto" />
            <p className="mt-4 max-w-md text-lg leading-snug text-muted-foreground">
              Staffing built on judgment, not volume. We place people who fit — not just resumes
              that match.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <h4 className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Navigate
              </h4>
              <ul className="mt-5 space-y-3">
                <li>
                  <Link
                    to="/"
                    className="text-muted-foreground active:text-foreground [@media(hover:hover)]:hover:text-foreground"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    to="/about"
                    className="text-muted-foreground active:text-foreground [@media(hover:hover)]:hover:text-foreground"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    to="/jobs"
                    className="text-muted-foreground active:text-foreground [@media(hover:hover)]:hover:text-foreground"
                  >
                    Jobs
                  </Link>
                </li>
                <li>
                  <Link
                    to="/services"
                    className="text-muted-foreground active:text-foreground [@media(hover:hover)]:hover:text-foreground"
                  >
                    Services
                  </Link>
                </li>
                <li>
                  <Link
                    to="/programs"
                    className="text-muted-foreground active:text-foreground [@media(hover:hover)]:hover:text-foreground"
                  >
                    Programs
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Contact</h4>
              <ul className="mt-5 space-y-3 text-muted-foreground">
                <li>hello@savantstaffing.com</li>
                <li>Content coming soon</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--color-hairline)] pt-8 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <div>© {new Date().getFullYear()} Savant Staffing</div>
          <div>Talent, placed with precision</div>
        </div>
      </div>
    </footer>
  );
}
