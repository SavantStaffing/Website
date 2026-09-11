import { Link } from "@tanstack/react-router";
import { useState } from "react";
import savantLogo from "@/assets/savant-logo.png";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getDashboardPath } from "@/lib/auth/session";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/jobs", label: "Jobs" },
  { to: "/services", label: "Services" },
  { to: "/programs", label: "Programs" },
] as const;

export function SiteHeader() {
  const { auth, loading } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--color-hairline)] bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link to="/" className="flex items-center">
          <img src={savantLogo} alt="Savant" className="h-6 w-auto" />
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="text-[13px] text-muted-foreground transition-colors [@media(hover:hover)]:hover:text-foreground active:text-foreground"
              activeProps={{ className: "text-foreground" }}
              activeOptions={{ exact: n.to === "/" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-6 md:flex">
          {loading ? null : auth ? (
            <Link
              to={getDashboardPath(auth.role)}
              className="text-[13px] tracking-wide text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                search={{ mode: "login" } as never}
                className="text-[13px] text-muted-foreground [@media(hover:hover)]:hover:text-foreground active:text-foreground"
              >
                Log in
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" } as never}
                className="rounded-sm border border-foreground px-4 py-2 text-[12px] font-medium uppercase tracking-[0.15em] transition-colors [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background active:bg-foreground active:text-background"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden text-[13px] tracking-wide"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <div className="border-t border-[color:var(--color-hairline)] md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-6">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="py-3 text-sm text-muted-foreground active:text-foreground"
                activeProps={{ className: "text-foreground" }}
                activeOptions={{ exact: n.to === "/" }}
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-4 border-t border-[color:var(--color-hairline)] pt-4">
              {loading ? null : auth ? (
                <Link
                  to={getDashboardPath(auth.role)}
                  onClick={() => setOpen(false)}
                  className="text-sm"
                >
                  Dashboard
                </Link>
              ) : (
                <div className="flex gap-4">
                  <Link
                    to="/auth"
                    search={{ mode: "login" } as never}
                    onClick={() => setOpen(false)}
                    className="text-sm text-muted-foreground"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/auth"
                    search={{ mode: "signup" } as never}
                    onClick={() => setOpen(false)}
                    className="text-sm underline underline-offset-4"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
