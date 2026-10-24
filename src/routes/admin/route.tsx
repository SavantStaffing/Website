import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HubLayout } from "@/components/site/HubLayout";
import { requireRole } from "@/lib/auth/guards";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: () => requireRole("admin"),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/inbox", label: "Inbox" },
  { to: "/admin/chat", label: "Chat" },
  { to: "/admin/calendar", label: "Calendar" },
  { to: "/admin/schedule", label: "Talent & Schedule" },
  { to: "/admin/assignments", label: "Talent assignments" },
  { to: "/admin/intake", label: "Talent intake" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/recruiters", label: "Recruiters" },
  { to: "/admin/coach-invites", label: "Coach invites" },
  { to: "/admin/scout", label: "Job Scout" },
  { to: "/admin/ratings", label: "Ratings" },
  { to: "/admin/diagnostics", label: "Diagnostics" },
  { to: "/admin/architecture", label: "Architecture" },
  { to: "/admin/jobs", label: "Jobs" },
  { to: "/admin/scanners", label: "Unique scanners" },
  { to: "/admin/regions", label: "Regional scanners" },
  { to: "/admin/organizations", label: "Organizations" },
  { to: "/admin/messages", label: "Messages" },
  { to: "/temporary-staffing", label: "Temp Partners" },
  { to: "/admin/settings", label: "Settings" },
] as const;

function AdminLayout() {
  const { userId, displayName } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [unassigned, setUnassigned] = useState(0);

  // Recruiters with no organization yet, shown as "Recruiters (n)" as a reminder to assign them.
  // Re-counted on each admin page change so it drops after assigning on /admin/recruiters.
  useEffect(() => {
    (async () => {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "recruiter");
      const ids = (roleRows ?? []).map((r) => r.user_id);
      if (!ids.length) return setUnassigned(0);
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("id", ids)
        .is("organization_id", null);
      setUnassigned(count ?? 0);
    })();
  }, [pathname]);

  const nav = NAV.map((n) => (n.to === "/admin/recruiters" ? { ...n, count: unassigned } : n));
  return (
    <HubLayout eyebrow="Admin hub" name={displayName} userId={userId} nav={nav} root="/admin" />
  );
}
