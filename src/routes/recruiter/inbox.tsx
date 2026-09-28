import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "@/components/site/Inbox";

export const Route = createFileRoute("/recruiter/inbox")({
  head: () => ({
    meta: [{ title: "Inbox" }, { name: "robots", content: "noindex" }],
  }),
  component: InboxPage,
});

function InboxPage() {
  const { userId } = Route.useRouteContext();
  return <Inbox userId={userId} />;
}
