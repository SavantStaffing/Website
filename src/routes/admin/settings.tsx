import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [{ title: "Settings" }, { name: "robots", content: "noindex" }],
  }),
  component: Settings,
});

function Settings() {
  return (
    <section>
      <h2 className="text-2xl font-semibold">Platform settings</h2>
      <p className="mt-4 text-sm text-muted-foreground">Content coming soon.</p>
    </section>
  );
}
