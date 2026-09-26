import { createFileRoute } from "@tanstack/react-router";
import { AccountSettings } from "@/components/site/AccountSettings";

export const Route = createFileRoute("/coach/settings")({
  head: () => ({
    meta: [{ title: "Account Settings" }, { name: "robots", content: "noindex" }],
  }),
  component: CoachSettings,
});

function CoachSettings() {
  const { userId } = Route.useRouteContext();
  return <AccountSettings userId={userId} />;
}
