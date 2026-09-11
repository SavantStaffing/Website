import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — Savant Staffing" },
      { name: "description", content: "Staffing services offered by Savant Staffing." },
    ],
  }),
  component: Services,
});

const SERVICES = [
  { name: "Temporary Staffing", tag: "Flexible coverage, fast" },
  { name: "Direct Hire", tag: "Full-time placements" },
  { name: "Executive Search", tag: "Leadership & specialist roles" },
  { name: "Payrolling", tag: "Onboard talent you've already found" },
] as const;

function Services() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Services</p>
      <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">
        How we staff.
      </h1>
      <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Content coming soon.
      </p>

      <ul className="mt-16 border-t border-[color:var(--color-hairline)]">
        {SERVICES.map((s) => (
          <li
            key={s.name}
            className="flex flex-wrap items-baseline justify-between gap-6 border-b border-[color:var(--color-hairline)] py-10"
          >
            <div>
              <div className="text-3xl font-medium md:text-4xl">{s.name}</div>
              <div className="mt-3 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                {s.tag}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
