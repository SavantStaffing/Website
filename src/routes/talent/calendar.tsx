import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Calendar } from "@/components/site/Calendar";
import { TalentMeetingRequests } from "@/components/meetings/MeetingRequests";

export const Route = createFileRoute("/talent/calendar")({
  head: () => ({
    meta: [{ title: "Calendar" }, { name: "robots", content: "noindex" }],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { userId } = Route.useRouteContext();
  // Bumped when a meeting time is picked so the calendar shows it right away.
  const [calendarKey, setCalendarKey] = useState(0);
  return (
    <div className="space-y-14">
      <TalentMeetingRequests userId={userId} onChange={() => setCalendarKey((k) => k + 1)} />
      <Calendar userId={userId} refreshKey={calendarKey} />
    </div>
  );
}
