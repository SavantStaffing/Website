import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { requireRole } from "@/lib/auth/guards";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/talent")({
  ssr: false,
  beforeLoad: () => requireRole("talent"),
  component: TalentLayout,
});

const NAV = [
  { to: "/talent", label: "Dashboard" },
  { to: "/talent/jobs", label: "Find Jobs" },
  { to: "/talent/applications", label: "Applications" },
  { to: "/talent/profile", label: "Profile" },
] as const;

function TalentLayout() {
  const { userId, email } = Route.useRouteContext();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
    toast.success("Signed out.");
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-24">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[color:var(--color-hairline)] pb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Talent hub</p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{email}</h1>
        </div>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground [@media(hover:hover)]:hover:text-foreground disabled:opacity-50"
        >
          {signingOut ? "…" : "Sign out"}
        </button>
      </div>

      <nav className="mt-8 flex flex-wrap gap-8 text-[12px] uppercase tracking-[0.2em] text-muted-foreground">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="[@media(hover:hover)]:hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
            activeOptions={{ exact: n.to === "/talent" }}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="mt-12">
        <Outlet />
      </div>
    </div>
  );
}
