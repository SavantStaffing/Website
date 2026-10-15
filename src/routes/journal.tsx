import { createFileRoute, Link } from "@tanstack/react-router";
import { ENTRIES } from "@/lib/journal/entries";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "Journal — Savant Staffing" },
      {
        name: "description",
        content: "Practical, sourced writing on Bay Area careers, pay and training from Savant Staffing.",
      },
    ],
  }),
  component: Journal,
});

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

function Journal() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Journal</p>
      <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">
        Notes on work and pay.
      </h1>
      <ul className="mt-16 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
        {ENTRIES.map((e) => (
          <li key={e.slug}>
            <Link
              to="/journal/$slug"
              params={{ slug: e.slug }}
              className="group block py-10 [@media(hover:hover)]:hover:text-foreground"
            >
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                {fmt(e.date)}
              </p>
              <h2 className="mt-4 text-2xl font-semibold leading-snug md:text-3xl">{e.title}</h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
                {e.summary}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
