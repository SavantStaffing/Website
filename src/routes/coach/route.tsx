import { createFileRoute } from "@tanstack/react-router";
import { HubLayout } from "@/components/site/HubLayout";
import { requireRole } from "@/lib/auth/guards";

export const Route = createFileRoute("/coach")({
  ssr: false,
  beforeLoad: () => requireRole("career_coach"),
  component: CoachLayout,
});

const NAV = [
  { to: "/coach", label: "Service Requests" },
  { to: "/coach/inbox", label: "Inbox" },
  { to: "/coach/chat", label: "Chat" },
  { to: "/coach/schedule", label: "Talent & Schedule" },
  { to: "/coach/talent", label: "Talent" },
  { to: "/coach/recruiters", label: "Recruiters" },
  { to: "/jobs", label: "Jobs" },
  { to: "/temporary-staffing", label: "Temp Partners" },
  { to: "/coach/settings", label: "Settings" },
] as const;

function CoachLayout() {
  const { userId, displayName } = Route.useRouteContext();
  return (
    <HubLayout
      eyebrow="Career coach hub"
      name={displayName}
      userId={userId}
      nav={NAV}
      root="/coach"
    />
  );
}
