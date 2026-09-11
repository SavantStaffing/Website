import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/programs")({
  head: () => ({
    meta: [
      { title: "Programs — Savant Staffing" },
      { name: "description", content: "Workforce programs run by Savant Staffing." },
    ],
  }),
  component: Programs,
});

const PROGRAMS = [
  { name: "Apprenticeship Program", tag: "Entry-level talent, trained on the job" },
  { name: "Training & Certification", tag: "Upskilling for in-demand roles" },
  { name: "Diversity Hiring Initiative", tag: "Broadening the candidate pipeline" },
] as const;

function Programs() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Programs</p>
      <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">
        Beyond placement.
      </h1>
      <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Content coming soon.
      </p>

      <ul className="mt-16 border-t border-[color:var(--color-hairline)]">
        {PROGRAMS.map((p) => (
          <li
            key={p.name}
            className="flex flex-wrap items-baseline justify-between gap-6 border-b border-[color:var(--color-hairline)] py-10"
          >
            <div>
              <div className="text-3xl font-medium md:text-4xl">{p.name}</div>
              <div className="mt-3 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                {p.tag}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
