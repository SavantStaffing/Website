import { createFileRoute, Link } from "@tanstack/react-router";
import { ServiceSignupForm } from "@/components/preparation/ServiceSignupForm";
import { SERVICES } from "@/lib/services";

export const Route = createFileRoute("/preparation")({
  head: () => ({
    meta: [
      { title: "Preparation — Savant Staffing" },
      {
        name: "description",
        content:
          "Career programs, resume building, interview development, and job fairs with Savant Staffing's career coaches.",
      },
    ],
  }),
  component: Preparation,
});

function Preparation() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Preparation</p>
      <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">Beyond placement.</h1>

      <nav className="mt-10 flex flex-wrap gap-8 text-[12px] uppercase tracking-[0.2em] text-muted-foreground">
        {SERVICES.map((s) => (
          <a
            key={s.id}
            href={`#${s.anchor}`}
            className="[@media(hover:hover)]:hover:text-foreground"
          >
            {s.title}
          </a>
        ))}
      </nav>

      {SERVICES.map((s) => (
        <section
          key={s.id}
          id={s.anchor}
          className="mt-20 scroll-mt-28 border-t border-[color:var(--color-hairline)] pt-16"
        >
          <h2 className="text-3xl font-semibold md:text-4xl">{s.title}</h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {s.intro}
          </p>
          {s.items.length > 0 && (
            <ul className="mt-10 border-t border-[color:var(--color-hairline)]">
              {s.items.map((p) => (
                <li key={p.slug} className="border-b border-[color:var(--color-hairline)]">
                  <Link
                    to="/preparation/career-programs/$program"
                    params={{ program: p.slug }}
                    className="group flex flex-wrap items-baseline justify-between gap-6 py-8 transition-colors [@media(hover:hover)]:hover:bg-black/[0.02] active:bg-black/[0.03]"
                  >
                    <div>
                      <div className="text-2xl font-medium md:text-3xl">{p.name}</div>
                      <div className="mt-3 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                        {p.tag}
                      </div>
                    </div>
                    <div className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-muted-foreground [@media(hover:hover)]:group-hover:text-foreground group-active:text-foreground">
                      Explore →
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-10">
            <ServiceSignupForm service={s.id} />
          </div>
        </section>
      ))}
    </div>
  );
}
