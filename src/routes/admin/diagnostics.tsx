import { createFileRoute } from "@tanstack/react-router";
import { ScoutDiagnostics } from "@/components/admin/ScoutDiagnostics";

export const Route = createFileRoute("/admin/diagnostics")({
  head: () => ({
    meta: [{ title: "Diagnostics" }, { name: "robots", content: "noindex" }],
  }),
  component: ScoutDiagnostics,
});
