import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Savant Staffing — Talent, Placed with Precision" },
      {
        name: "description",
        content:
          "Savant Staffing connects businesses with vetted talent across temporary, direct-hire, and executive search placements.",
      },
    ],
  }),
  component: Home,
});

const SERVICES = [
  {
    slug: "temporary-staffing",
    name: "Temporary Staffing",
    tag: "Flexible coverage, fast",
    to: "/temporary-staffing",
  },
  {
    slug: "professional-roles",
    name: "Professional Roles",
    tag: "Full-time placements",
    to: "/services",
  },
  {
    slug: "preparation",
    name: "Preparation",
    tag: "Career programs & readiness",
    to: "/preparation",
  },
] as const;

function Home() {
  return (
    <>
      <HeroSection />
      <ServicesPreview />
      <ProgramsPreview />
    </>
  );
}

function HeroSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 pt-20 pb-24 lg:px-10 lg:pt-28 lg:pb-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
        Savant Staffing
      </p>
      <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight md:text-6xl lg:text-7xl">
        Talent, placed with <span className="text-brass">precision.</span>
      </h1>
      <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground">
        We match businesses with people who fit — across temporary staffing, direct hire, and
        executive search. Content coming soon.
      </p>
      <div className="mt-10 flex flex-wrap gap-6 text-[12px] uppercase tracking-[0.2em]">
        <Link
          to="/jobs"
          className="border-b border-foreground pb-1 [@media(hover:hover)]:hover:text-muted-foreground"
        >
          Browse Jobs
        </Link>
        <Link
          to="/services"
          className="border-b border-muted-foreground pb-1 text-muted-foreground [@media(hover:hover)]:hover:text-foreground [@media(hover:hover)]:hover:border-foreground"
        >
          Our Services
        </Link>
      </div>
    </section>
  );
}

function ServicesPreview() {
  return (
    <section className="border-t border-[color:var(--color-hairline)]">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
        <div className="mb-16 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              What We Do
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight md:text-5xl">
              Staffing, done deliberately.
            </h2>
          </div>
          <Link
            to="/services"
            className="text-[12px] uppercase tracking-[0.2em] text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
          >
            All services →
          </Link>
        </div>

        <ul className="border-t border-[color:var(--color-hairline)]">
          {SERVICES.map((s) => (
            <li key={s.slug}>
              <Link
                to={s.to}
                className="group flex flex-wrap items-baseline justify-between gap-6 border-b border-[color:var(--color-hairline)] py-10 transition-colors [@media(hover:hover)]:hover:bg-black/[0.02] active:bg-black/[0.03]"
              >
                <div>
                  <div className="text-3xl font-medium md:text-4xl">{s.name}</div>
                  <div className="mt-3 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                    {s.tag}
                  </div>
                </div>
                <div className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-muted-foreground [@media(hover:hover)]:group-hover:text-foreground group-active:text-foreground">
                  Learn more →
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ProgramsPreview() {
  return (
    <section className="border-t border-[color:var(--color-hairline)]">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Career Programs
        </p>
        <h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight md:text-5xl">
          Investing beyond the placement.
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Training, apprenticeships, and career-development programs built alongside our clients.
          Content coming soon.
        </p>
        <div className="mt-10">
          <Link
            to="/preparation"
            hash="career-programs"
            className="border-b border-foreground pb-1 text-[12px] uppercase tracking-[0.2em] [@media(hover:hover)]:hover:text-muted-foreground"
          >
            Explore Programs
          </Link>
        </div>
      </div>
    </section>
  );
}
