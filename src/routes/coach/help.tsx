import { createFileRoute } from "@tanstack/react-router";
import { HelpCenter } from "@/components/site/HelpCenter";

export const Route = createFileRoute("/coach/help")({
  head: () => ({
    meta: [{ title: "Help" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <HelpCenter role="coach" guide="/coach/welcome" />,
});
