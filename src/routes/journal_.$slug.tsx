import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { JournalBody } from "@/components/site/JournalBody";
import { getEntry } from "@/lib/journal/entries";

export const Route = createFileRoute("/journal_/$slug")({
  loader: ({ params }) => {
    const entry = getEntry(params.slug);
    if (!entry) throw notFound();
    return entry;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Journal"} — Savant Staffing` },
      { name: "description", content: loaderData?.summary ?? "" },
    ],
  }),
  component: Article,
  notFoundComponent: () => (
    <div className="mx-auto max-w-4xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-muted-foreground">That entry doesn't exist.</p>
      <Link to="/journal" className="mt-6 inline-block underline underline-offset-4">
        Back to the journal
      </Link>
    </div>
  ),
});

function Article() {
  const entry = Route.useLoaderData();
  const date = new Date(`${entry.date}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <article className="mx-auto max-w-4xl px-6 py-24 lg:px-10 lg:py-32">
      <Link
        to="/journal"
        className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
      >
        ← Journal
      </Link>
      <p className="mt-10 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{date}</p>
      <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">{entry.title}</h1>
      <div className="mt-12 max-w-3xl">
        <JournalBody blocks={entry.blocks} />
      </div>
    </article>
  );
}
