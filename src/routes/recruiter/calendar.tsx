import { createFileRoute, redirect } from "@tanstack/react-router";

/** The calendar now lives at the bottom of Schedule. */
export const Route = createFileRoute("/recruiter/calendar")({
  beforeLoad: () => {
    throw redirect({ to: "/recruiter/schedule", replace: true });
  },
});
