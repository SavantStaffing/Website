import { createFileRoute } from "@tanstack/react-router";
import { TempStaffingOverview } from "@/components/temp/TempStaffingOverview";

export const Route = createFileRoute("/talent/temporary-work")({
  head: () => ({
    meta: [{ title: "Temporary Work" }, { name: "robots", content: "noindex" }],
  }),
  component: TalentTemporaryWork,
});

function TalentTemporaryWork() {
  return (
    <section>
      <h2 className="text-2xl font-semibold">Temporary work</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Pick up shifts through Savant's partner platforms. Compare the roles, companies and pay on
        each, then sign up with the ones that fit.
      </p>
      <div className="mt-10">
        <TempStaffingOverview withSignup />
      </div>
    </section>
  );
}
