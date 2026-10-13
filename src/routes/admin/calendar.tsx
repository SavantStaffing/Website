import { createFileRoute } from "@tanstack/react-router";
import { Calendar } from "@/components/site/Calendar";

export const Route = createFileRoute("/admin/calendar")({
  head: () => ({
    meta: [{ title: "Calendar" }, { name: "robots", content: "noindex" }],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { userId } = Route.useRouteContext();
  return <Calendar userId={userId} />;
}
