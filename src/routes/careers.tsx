import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { list, mutedButton } from "@/components/site/ui";
import {
  byIndustry,
  EVENT_TYPE_LABEL,
  industriesOf,
  NO_INDUSTRY,
  PROGRAM_TYPE_LABEL,
  type CareerEvent,
  type CareerProgram,
} from "@/lib/careers";

type Tab = "programs" | "events";

export const Route = createFileRoute("/careers")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab; industry?: string } => ({
    // Programs is the default tab, so it stays out of the URL.
    tab: search.tab === "events" ? "events" : undefined,
    industry: typeof search.industry === "string" && search.industry ? search.industry : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Careers — Savant Staffing" },
      {
        name: "description",
        content: "Career programs and local career events, organised by industry.",
      },
    ],
  }),
  component: Careers,
});

const TABS: { id: Tab; label: string }[] = [
  { id: "programs", label: "Programs" },
  { id: "events", label: "Events" },
];

function Careers() {
  const { tab = "programs", industry } = Route.useSearch();
  const [programs, setPrograms] = useState<CareerProgram[] | null>(null);
  const [events, setEvents] = useState<CareerEvent[] | null>(null);

  // Each feed loads the first time its tab is opened.
  useEffect(() => {
    if (tab === "programs" && programs === null) {
      supabase
        .from("career_programs")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(500)
        .then(({ data }) => setPrograms(data ?? []));
    }
    if (tab === "events" && events === null) {
      supabase
        .from("career_events")
        .select("*")
        .eq("status", "active")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(500)
        .then(({ data }) => setEvents(data ?? []));
    }
  }, [tab, programs, events]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Careers</p>
      <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">
        Build the career, not just the résumé.
      </h1>
      <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Training programs and local events worth your time, sorted by the industry they lead into.
      </p>

      <div
        role="tablist"
        aria-label="Careers feeds"
        className="mt-12 flex gap-8 border-b border-[color:var(--color-hairline)]"
      >
        {TABS.map((t) => (
          <Link
            key={t.id}
            to="/careers"
            search={{ tab: t.id === "events" ? "events" : undefined }}
            role="tab"
            aria-selected={tab === t.id}
            className={`-mb-px border-b pb-3 text-[12px] uppercase tracking-[0.2em] ${
              tab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "programs" ? (
        <Feed
          tab="programs"
          rows={programs}
          industry={industry}
          empty="Career programs are on the way. Check back soon."
          render={(p) => <ProgramItem key={p.id} program={p} />}
        />
      ) : (
        <Feed
          tab="events"
          rows={events}
          industry={industry}
          empty="No upcoming events listed yet. Check back soon."
          render={(e) => <EventItem key={e.id} event={e} />}
        />
      )}
    </div>
  );
}

/** One feed: industry filter on top, then rows grouped under their industry. */
function Feed<T extends { industry: string | null }>({
  tab,
  rows,
  industry,
  empty,
  render,
}: {
  tab: Tab;
  rows: T[] | null;
  industry: string | undefined;
  empty: string;
  render: (row: T) => ReactNode;
}) {
  if (rows === null) return <p className="mt-10 text-sm text-muted-foreground">Loading…</p>;
  if (rows.length === 0)
    return (
      <div className="mt-10 rounded-sm border border-[color:var(--color-hairline)] p-6">
        <p className="text-sm text-muted-foreground">{empty}</p>
      </div>
    );

  const industries = industriesOf(rows);
  const selected = industry && industries.includes(industry) ? industry : undefined;
  const groups = byIndustry(rows).filter(([name]) => !selected || name === selected);

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
        {[undefined, ...industries].map((name) => (
          <Link
            key={name ?? "all"}
            to="/careers"
            search={{ tab: tab === "events" ? "events" : undefined, industry: name }}
            className={`${mutedButton} ${
              selected === name ? "text-foreground underline underline-offset-4" : ""
            }`}
          >
            {name ?? "All industries"}
          </Link>
        ))}
      </div>

      {groups.map(([name, items]) => (
        <section key={name} className="mt-12">
          <h2 className="text-2xl font-semibold">
            {name === NO_INDUSTRY ? "General" : name}
            <span className="ml-3 text-sm font-normal text-muted-foreground">{items.length}</span>
          </h2>
          <ul className={`mt-5 ${list}`}>{items.map(render)}</ul>
        </section>
      ))}
    </>
  );
}

const meta = "mt-1 text-[11px] uppercase tracking-[0.25em] text-muted-foreground";

function Item({
  title,
  details,
  description,
  tag,
  url,
  action,
}: {
  title: string;
  details: (string | null | false)[];
  description: string | null;
  tag: string;
  url: string | null;
  action: string;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-4 py-6">
      <div className="min-w-0 flex-1 basis-80">
        <div className="text-lg font-medium">{title}</div>
        <div className={meta}>{details.filter(Boolean).join(" · ") || "—"}</div>
        {description && (
          <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-5">
        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{tag}</span>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className={mutedButton}>
            {action} ↗
          </a>
        )}
      </div>
    </li>
  );
}

const day = (d: string) =>
  // Date-only columns: pin to noon so the day doesn't shift with the viewer's timezone.
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function ProgramItem({ program: p }: { program: CareerProgram }) {
  return (
    <Item
      title={p.title}
      details={[
        p.provider,
        p.remote ? (p.location ? `${p.location} or remote` : "Remote") : p.location,
        p.duration_note,
        p.cost_note,
        p.apply_by && `Apply by ${day(p.apply_by)}`,
      ]}
      description={p.description}
      tag={PROGRAM_TYPE_LABEL[p.program_type] ?? p.program_type}
      url={p.url}
      action="Learn more"
    />
  );
}

function EventItem({ event: e }: { event: CareerEvent }) {
  const when = new Date(e.starts_at).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <Item
      title={e.title}
      details={[
        when,
        e.organizer,
        e.virtual ? "Online" : [e.venue, e.location].filter(Boolean).join(", ") || null,
        e.cost_note,
      ]}
      description={e.description}
      tag={EVENT_TYPE_LABEL[e.event_type] ?? e.event_type}
      url={e.url}
      action="Details"
    />
  );
}
