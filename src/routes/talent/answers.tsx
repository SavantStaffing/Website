import { createFileRoute, redirect } from "@tanstack/react-router";

// Saved answers now live on the Talent Profile page.
export const Route = createFileRoute("/talent/answers")({
  beforeLoad: () => {
    throw redirect({ to: "/talent/profile", hash: "saved-answers", replace: true });
  },
});
