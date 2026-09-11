import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { mode: "login" } });
    }
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (roleRows ?? []).map((r) => r.role);
    const role: AppRole = roles.includes("admin")
      ? "admin"
      : roles.includes("recruiter")
        ? "recruiter"
        : "job_seeker";
    return { user: data.user, role };
  },
  component: AuthedLayout,
});

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin hub",
  recruiter: "Recruiter hub",
  job_seeker: "Candidate hub",
};

function AuthedLayout() {
  const { user, role } = Route.useRouteContext();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", search: { mode: "login" }, replace: true });
    toast.success("Signed out.");
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-24">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[color:var(--color-hairline)] pb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            {ROLE_LABEL[role]}
          </p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{user.email}</h1>
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
        <Link
          to="/hub"
          className="[@media(hover:hover)]:hover:text-foreground"
          activeProps={{ className: "text-foreground" }}
          activeOptions={{ exact: true }}
        >
          Account
        </Link>
        {role === "job_seeker" && (
          <Link
            to="/hub/candidate"
            className="[@media(hover:hover)]:hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            Applications
          </Link>
        )}
        {role === "recruiter" && (
          <Link
            to="/hub/recruiter"
            className="[@media(hover:hover)]:hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            Postings
          </Link>
        )}
        {role === "admin" && (
          <Link
            to="/hub/admin"
            className="[@media(hover:hover)]:hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            Admin
          </Link>
        )}
      </nav>

      <div className="mt-12">
        <Outlet />
      </div>
    </div>
  );
}
