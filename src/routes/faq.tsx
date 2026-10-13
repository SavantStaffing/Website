import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FaqList } from "@/components/site/HelpCenter";
import { CONTACT_EMAIL, FAQ, ROLE_LABEL, type HelpRole } from "@/lib/help/knowledge";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Savant Staffing" },
      {
        name: "description",
        content:
          "Answers for job seekers, recruiters and career coaches: applying, pricing, employer ratings, coaching and more.",
      },
    ],
  }),
  component: FaqPage,
});

const ROLES: HelpRole[] = ["talent", "recruiter", "coach"];

/** Public FAQ for every account type; each hub's Help page shows its own section. */
function FaqPage() {
  const [filter, setFilter] = useState("");
  const term = filter.trim().toLowerCase();

  return (
    <div className="mx-auto max-w-3xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Help</p>
      <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">
        Frequently asked questions
      </h1>
      <p className="mt-6 text-base leading-relaxed text-muted-foreground">
        Signed in? Your hub's <strong className="font-medium text-foreground">Help</strong> page
        also has an assistant that answers questions from these answers.
      </p>

      <nav
        aria-label="Sections"
        className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[12px] uppercase tracking-[0.2em]"
      >
        {ROLES.map((r) => (
          <a
            key={r}
            href={`#${r}`}
            className="underline-offset-4 [@media(hover:hover)]:hover:underline"
          >
            {ROLE_LABEL[r]}
          </a>
        ))}
      </nav>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search questions"
        aria-label="Search questions"
        className="mt-8 w-full border-b border-[color:var(--color-hairline)] bg-transparent py-2 text-sm outline-none focus:border-foreground"
      />

      {ROLES.map((r) => {
        const items = term
          ? FAQ[r].filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(term))
          : FAQ[r];
        if (!items.length) return null;
        return (
          <section key={r} id={r} className="mt-14 scroll-mt-28">
            <h2 className="text-2xl font-semibold">{ROLE_LABEL[r]}</h2>
            <div className="mt-4">
              <FaqList items={items} open={!!term} />
            </div>
          </section>
        );
      })}

      <p className="mt-16 text-sm text-muted-foreground">
        Didn't find it? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>{" "}
        or use the{" "}
        <Link to="/contact" className="underline underline-offset-4">
          Contact page
        </Link>
        .
      </p>
    </div>
  );
}
