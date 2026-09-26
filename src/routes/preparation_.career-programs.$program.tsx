import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ServiceSignupForm } from "@/components/preparation/ServiceSignupForm";
import { label } from "@/components/site/ui";
import { CAREER_PROGRAMS } from "@/lib/services";

export const Route = createFileRoute("/preparation_/career-programs/$program")({
  loader: ({ params }) => {
    const program = CAREER_PROGRAMS.find((p) => p.slug === params.program);
    if (!program) throw notFound();
    return program;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Career Programs"} — Savant Staffing` },
      { name: "description", content: loaderData?.tag ?? "Savant career programs." },
    ],
  }),
  component: CareerProgramPage,
});

/** In-depth page for one Career Programs subsection. */
function CareerProgramPage() {
  const p = Route.useLoaderData();
  const others = CAREER_PROGRAMS.filter((o) => o.slug !== p.slug);
  const blocks = [
    { title: "Who it's for", items: p.whoItsFor },
    { title: "What you get", items: p.whatYouGet },
    { title: "How it works", items: p.howItWorks },
  ];
  const hasDetail = !!p.overview || blocks.some((b) => b.items.length);

  return (
    <div className="mx-auto max-w-5xl px-6 py-24 lg:px-10 lg:py-32">
      <Link
        to="/preparation"
        hash="career-programs"
        className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
      >
        ← Preparation · Career Programs
      </Link>
      <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">{p.name}</h1>
      <p className="mt-4 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">{p.tag}</p>

      {p.overview && <p className="mt-10 max-w-2xl text-lg leading-relaxed">{p.overview}</p>}

      {hasDetail ? (
        <div className="mt-14 grid gap-12 md:grid-cols-3">
          {blocks
            .filter((b) => b.items.length)
            .map((b) => (
              <div key={b.title}>
                <div className={label}>{b.title}</div>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed">
                  {b.items.map((i) => (
                    <li key={i} className="flex gap-3">
                      <span aria-hidden className="text-brass">
                        —
                      </span>
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      ) : (
        <p className="mt-10 max-w-2xl text-base text-muted-foreground">
          Details coming soon. Sign up below and a Savant career coach will walk you through it.
        </p>
      )}

      <section className="mt-20 border-t border-[color:var(--color-hairline)] pt-14">
        <h2 className="text-2xl font-semibold">Interested?</h2>
        <div className="mt-6">
          <ServiceSignupForm service="career_programs" defaultProgram={p.name} />
        </div>
      </section>

      <section className="mt-20">
        <div className={label}>Other career programs</div>
        <ul className="mt-4 border-t border-[color:var(--color-hairline)]">
          {others.map((o) => (
            <li key={o.slug} className="border-b border-[color:var(--color-hairline)]">
              <Link
                to="/preparation/career-programs/$program"
                params={{ program: o.slug }}
                className="group flex flex-wrap items-baseline justify-between gap-4 py-5 [@media(hover:hover)]:hover:bg-black/[0.02]"
              >
                <span className="text-lg">{o.name}</span>
                <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground [@media(hover:hover)]:group-hover:text-foreground">
                  Explore →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
