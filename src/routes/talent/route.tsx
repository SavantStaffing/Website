import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { HubLayout } from "@/components/site/HubLayout";
import { connectSavantApplyExtension } from "@/lib/autofill/extensionBridge";
import { requireRole } from "@/lib/auth/guards";

export const Route = createFileRoute("/talent")({
  ssr: false,
  beforeLoad: () => requireRole("talent"),
  component: TalentLayout,
});

const NAV = [
  { to: "/talent", label: "Dashboard" },
  { to: "/talent/inbox", label: "Inbox" },
  { to: "/talent/jobs", label: "Job Feed" },
  { to: "/talent/temporary-work", label: "Temporary Work" },
  { to: "/talent/applications", label: "Applications" },
  { to: "/talent/profile", label: "Talent Profile" },
  { to: "/talent/preferences", label: "Preferences" },
  { to: "/talent/settings", label: "Settings" },
] as const;

function TalentLayout() {
  const { userId, displayName } = Route.useRouteContext();
  // Lets the Savant Apply extension autofill applications as this talent.
  useEffect(() => connectSavantApplyExtension(), []);
  return (
    <HubLayout eyebrow="Talent hub" name={displayName} userId={userId} nav={NAV} root="/talent" />
  );
}
