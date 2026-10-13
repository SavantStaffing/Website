import { createFileRoute } from "@tanstack/react-router";
import { HelpCenter } from "@/components/site/HelpCenter";

export const Route = createFileRoute("/recruiter/help")({
  head: () => ({
    meta: [{ title: "Help" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <HelpCenter role="recruiter" guide="/recruiter/welcome" />,
});
