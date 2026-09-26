import { createFileRoute } from "@tanstack/react-router";
import { HubLayout } from "@/components/site/HubLayout";
import { requireRole } from "@/lib/auth/guards";

export const Route = createFileRoute("/recruiter")({
  ssr: false,
  beforeLoad: () => requireRole("recruiter"),
  component: RecruiterLayout,
});

const NAV = [
  { to: "/recruiter", label: "Dashboard" },
  { to: "/recruiter/talent", label: "Talent Feed" },
  { to: "/recruiter/saved", label: "Saved Talent" },
  { to: "/recruiter/jobs", label: "Jobs" },
  { to: "/recruiter/applications", label: "Applications" },
  { to: "/recruiter/company", label: "Company" },
  { to: "/recruiter/account", label: "Account" },
] as const;

function RecruiterLayout() {
  const { userId, email } = Route.useRouteContext();
  return (
    <HubLayout eyebrow="Recruiter hub" email={email} userId={userId} nav={NAV} root="/recruiter" />
  );
}
