import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { HubLayout } from "@/components/site/HubLayout";
import { connectSavantCoachExtension } from "@/lib/autofill/extensionBridge";
import { requireRole } from "@/lib/auth/guards";

export const Route = createFileRoute("/coach")({
  ssr: false,
  beforeLoad: () => requireRole("career_coach"),
  component: CoachLayout,
});

const NAV = [
  { to: "/coach/welcome", label: "Getting started" },
  { to: "/coach", label: "Service Requests" },
  { to: "/coach/inbox", label: "Inbox" },
  { to: "/coach/chat", label: "Chat" },
  { to: "/coach/schedule", label: "Schedule" },
  { to: "/coach/talent", label: "Talent" },
  { to: "/coach/recruiters", label: "Recruiters" },
  { to: "/coach/extension", label: "Listing Checker" },
  { to: "/jobs", label: "Jobs" },
  { to: "/temporary-staffing", label: "Temp Partners" },
  { to: "/coach/settings", label: "Settings" },
  { to: "/coach/help", label: "Help" },
] as const;

function CoachLayout() {
  const { userId, displayName } = Route.useRouteContext();
  // Lets the Savant Coach extension check listings as this coach.
  useEffect(() => connectSavantCoachExtension(), []);
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
