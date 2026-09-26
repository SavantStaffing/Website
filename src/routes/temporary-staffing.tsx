import { createFileRoute } from "@tanstack/react-router";
import { TempStaffingOverview } from "@/components/temp/TempStaffingOverview";

export const Route = createFileRoute("/temporary-staffing")({
  head: () => ({
    meta: [
      { title: "Temporary Staffing — Savant Staffing" },
      {
        name: "description",
        content:
          "Temporary and shift work through Savant's partner platforms: Bluecrew, WorkWhile and Instawork.",
      },
    ],
  }),
  component: TemporaryStaffing,
});

function TemporaryStaffing() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
        Temporary Staffing
      </p>
      <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">
        Flexible work, through partners we trust.
      </h1>
      <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Savant works with three shift-work platforms. Here's what kinds of roles each one offers,
        who's hiring on it, how busy it is, and what it pays.
      </p>
      <div className="mt-14">
        <TempStaffingOverview />
      </div>
    </div>
  );
}
