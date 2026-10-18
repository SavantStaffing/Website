import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { GuideList, GuideMeta } from "@/components/site/GuideList";
import { JournalBody } from "@/components/site/JournalBody";
import { mutedButton } from "@/components/site/ui";
import { getEntry, SORTED_ENTRIES } from "@/lib/journal/entries";

// A written guide, read alongside the regional data on /insights.
export const Route = createFileRoute("/insights_/$slug")({
  loader: ({ params }) => {
    const entry = getEntry(params.slug);
    if (!entry) throw notFound();
    return entry;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Insights"} — Savant Talent` },
      { name: "description", content: loaderData?.summary ?? "" },
    ],
  }),
  component: Article,
  notFoundComponent: () => (
    <div className="mx-auto max-w-4xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-muted-foreground">That guide doesn't exist.</p>
      <Link to="/insights" hash="guides" className="mt-6 inline-block underline underline-offset-4">
        Back to Insights
      </Link>
    </div>
  ),
});

const back =
  "text-[11px] uppercase tracking-[0.3em] text-muted-foreground [@media(hover:hover)]:hover:text-foreground";

function Article() {
  const entry = Route.useLoaderData();
  const more = SORTED_ENTRIES.filter((e) => e.slug !== entry.slug);

  return (
    <article className="mx-auto max-w-4xl px-6 py-24 lg:px-10 lg:py-32">
      <Link to="/insights" hash="guides" className={back}>
        ← Insights
      </Link>
      <div className="mt-10">
        <GuideMeta entry={entry} />
      </div>
      <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">{entry.title}</h1>
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
        {entry.summary}
      </p>
      <div className="mt-12 max-w-3xl">
        <JournalBody blocks={entry.blocks} />
      </div>

      {entry.cta && (
        <section className="mt-20 flex flex-wrap items-center justify-between gap-6 border border-[color:var(--color-hairline)] p-8">
          <div className="max-w-xl">
            <div className="text-xl font-medium">{entry.cta.title}</div>
            <p className="mt-2 text-sm text-muted-foreground">{entry.cta.body}</p>
          </div>
          <Link to={entry.cta.to} className={mutedButton}>
            {entry.cta.label}
          </Link>
        </section>
      )}

      <section className="mt-20 border border-[color:var(--color-hairline)] p-8">
        <div className="text-xl font-medium">See the numbers for your region</div>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Unemployment, pay by occupation and 10-year demand for every California region, from EDD
          labor market data.
        </p>
        <Link to="/insights" className={`mt-6 inline-block ${mutedButton}`}>
          Explore regional data →
        </Link>
      </section>

      {more.length > 0 && (
        <section className="mt-20">
          <h2 className="text-2xl font-semibold">More guides</h2>
          <GuideList entries={more} />
        </section>
      )}
    </article>
  );
}
