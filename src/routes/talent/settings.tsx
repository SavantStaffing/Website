import { createFileRoute } from "@tanstack/react-router";
import { AccountSettings } from "@/components/site/AccountSettings";

export const Route = createFileRoute("/talent/settings")({
  head: () => ({
    meta: [{ title: "Account Settings" }, { name: "robots", content: "noindex" }],
  }),
  component: TalentSettings,
});

function TalentSettings() {
  const { userId } = Route.useRouteContext();
  return (
    <div>
      <AccountSettings userId={userId} />
      <div className="mt-16 max-w-2xl">
        <h2 className="text-2xl font-semibold">Savant Apply browser extension</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          On Greenhouse, Lever and Ashby application pages, Savant Apply fills the form from your
          profile and highlights anything you need to check. It never submits for you. Ask your
          Savant contact for the extension until it's listed in the Chrome Web Store.
        </p>
      </div>
    </div>
  );
}
