import { createFileRoute, redirect } from "@tanstack/react-router";

// "Career Programs" became a section of the Preparation page; keep old links working.
export const Route = createFileRoute("/programs")({
  beforeLoad: () => {
    throw redirect({ to: "/preparation", hash: "career-programs", statusCode: 301 });
  },
});
