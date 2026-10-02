import { createFileRoute } from "@tanstack/react-router";
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
  { to: "/admin/schedule", label: "Talent & Schedule" },
  { to: "/admin/assignments", label: "Talent assignments" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/coach-invites", label: "Coach invites" },
  { to: "/admin/scout", label: "Job Scout" },
  { to: "/admin/ratings", label: "Ratings" },
  { to: "/admin/diagnostics", label: "Diagnostics" },
  { to: "/admin/jobs", label: "Jobs" },
  { to: "/admin/scanners", label: "Unique scanners" },
  { to: "/admin/organizations", label: "Organizations" },
  { to: "/admin/messages", label: "Messages" },
  { to: "/temporary-staffing", label: "Temp Partners" },
  { to: "/admin/settings", label: "Settings" },
] as const;

function AdminLayout() {
  const { userId, displayName } = Route.useRouteContext();
  return (
    <HubLayout eyebrow="Admin hub" name={displayName} userId={userId} nav={NAV} root="/admin" />
  );
}
