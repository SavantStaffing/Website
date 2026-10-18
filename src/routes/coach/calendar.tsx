import { createFileRoute, redirect } from "@tanstack/react-router";

/** The calendar now lives at the bottom of Schedule. */
export const Route = createFileRoute("/coach/calendar")({
  beforeLoad: () => {
    throw redirect({ to: "/coach/schedule", replace: true });
  },
});
