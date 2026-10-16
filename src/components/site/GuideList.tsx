import { Link } from "@tanstack/react-router";
import { label, list } from "@/components/site/ui";
import { readMinutes } from "@/lib/journal/entries";
import type { JournalEntry } from "@/lib/journal/types";

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/** Category · date · reading time, the byline used on guide cards and articles. */
export function GuideMeta({ entry }: { entry: JournalEntry }) {
  return (
    <p className={label}>
      {entry.category} · {fmtDate(entry.date)} · {readMinutes(entry)} min read
    </p>
  );
}

/** Written guides that sit alongside the Insights data. */
export function GuideList({ entries }: { entries: JournalEntry[] }) {
  return (
    <ul className={`mt-10 ${list}`}>
      {entries.map((e) => (
        <li key={e.slug}>
          <Link
            to="/insights/$slug"
            params={{ slug: e.slug }}
            className="group grid gap-4 py-8 md:grid-cols-[1fr_2fr] md:gap-10"
          >
            <GuideMeta entry={e} />
            <div>
              <h3 className="text-xl font-semibold leading-snug md:text-2xl [@media(hover:hover)]:group-hover:underline [@media(hover:hover)]:group-hover:underline-offset-4">
                {e.title}
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {e.summary}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
