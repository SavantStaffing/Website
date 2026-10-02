import { Link } from "@tanstack/react-router";
import savantEmblem from "@/assets/savant-emblem.png";
import savantLogo from "@/assets/savant-logo.png";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-[color:var(--color-hairline)]">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="grid gap-16 md:grid-cols-2 md:gap-24">
          <div>
            <div className="flex items-center gap-2.5">
              <img src={savantLogo} alt="Savant" className="h-6 w-auto" />
              <img src={savantEmblem} alt="" aria-hidden className="h-7 w-auto" />
            </div>
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
                    to="/insights"
                    className="text-muted-foreground active:text-foreground [@media(hover:hover)]:hover:text-foreground"
                  >
                    Insights
                  </Link>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="text-muted-foreground active:text-foreground [@media(hover:hover)]:hover:text-foreground"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Contact</h4>
              <ul className="mt-5 space-y-3 text-muted-foreground">
                <li>info@savantalent.com</li>
                <li>
                  <Link
                    to="/contact"
                    className="active:text-foreground [@media(hover:hover)]:hover:text-foreground"
                  >
                    Send us a message →
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--color-hairline)] pt-8 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>© {new Date().getFullYear()} Savant Staffing</span>
            <Link to="/terms" className="[@media(hover:hover)]:hover:text-foreground">
              Terms of Use
            </Link>
            <Link to="/privacy" className="[@media(hover:hover)]:hover:text-foreground">
              Privacy
            </Link>
          </div>
          <div>Talent, placed with precision</div>
        </div>
      </div>
    </footer>
  );
}
