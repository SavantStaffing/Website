import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { googleCalendarUrl, toIcs, type CalendarItem } from "@/lib/calendar/ics";
import { Empty, SectionHeading, label, linkButton, mutedButton, primaryButton } from "./ui";

/**
 * Calendar: coaching sessions, interviews and personal events in one place
 * (my_calendar(), migration 20261012000001). Sessions and interviews come
 * from where they're scheduled (Talent & Schedule); personal events are added
 * here. A private feed link syncs it one way into Google, Outlook or Apple.
 */

const KIND: Record<string, { label: string; dot: string }> = {
  session: { label: "Coaching session", dot: "bg-emerald-600" },
  interview: { label: "Interview", dot: "bg-sky-600" },
  event: { label: "Your event", dot: "bg-[color:var(--color-brass)]" },
};

const DAY_MS = 86_400_000;
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

function downloadIcs(item: CalendarItem) {
  const blob = new Blob([toIcs([item], item.title)], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${item.title.replace(/[^\w -]+/g, "").slice(0, 60) || "event"}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Calendar({ userId }: { userId: string }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [items, setItems] = useState<CalendarItem[] | null>(null);
  const [upcoming, setUpcoming] = useState<CalendarItem[] | null>(null);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  // The grid: Sunday on or before the 1st, six weeks.
  const gridStart = useMemo(() => {
    const d = new Date(month);
    d.setDate(1 - d.getDay());
    return d;
  }, [month]);
  const days = useMemo(
    () => Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * DAY_MS)),
    [gridStart],
  );

  const load = useCallback(async () => {
    const from = gridStart.toISOString();
    const to = new Date(gridStart.getTime() + 42 * DAY_MS).toISOString();
    const now = new Date();
    const [grid, next] = await Promise.all([
      supabase.rpc("my_calendar", { _from: from, _to: to }),
      supabase.rpc("my_calendar", {
        _from: now.toISOString(),
        _to: new Date(now.getTime() + 60 * DAY_MS).toISOString(),
      }),
    ]);
    if (grid.error) return toast.error(grid.error.message);
    setItems((grid.data ?? []) as CalendarItem[]);
    setUpcoming(((next.data ?? []) as CalendarItem[]).slice(0, 12));
  }, [gridStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const e of items ?? []) {
      const k = new Date(e.starts_at).toDateString();
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [items]);

  async function removeEvent(item: CalendarItem) {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", item.id.replace(/^event-/, ""));
    if (error) return toast.error(error.message);
    setSelected(null);
    void load();
  }

  const today = new Date();
  const monthName = month.toLocaleDateString([], { month: "long", year: "numeric" });

  return (
    <section>
      <SectionHeading title="Calendar">
        <div className="flex flex-wrap gap-5">
          <button onClick={() => setAdding((a) => !a)} className={mutedButton}>
            {adding ? "Cancel" : "Add event"}
          </button>
          <button onClick={() => setSyncOpen((s) => !s)} className={mutedButton}>
            Sync to your calendar
          </button>
        </div>
      </SectionHeading>
      <p className="mt-2 text-sm text-muted-foreground">
        Interviews and coaching sessions appear here automatically once they're scheduled.
      </p>

      {adding && (
        <AddEvent
          userId={userId}
          onDone={() => {
            setAdding(false);
            void load();
          }}
        />
      )}
      {syncOpen && <SyncPanel />}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* Month */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">{monthName}</h2>
            <div className="flex items-center gap-1">
              <button
                aria-label="Previous month"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="p-2 [@media(hover:hover)]:hover:bg-muted/40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setMonth(startOfMonth(new Date()))}
                className={`px-2 ${mutedButton}`}
              >
                Today
              </button>
              <button
                aria-label="Next month"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="p-2 [@media(hover:hover)]:hover:bg-muted/40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 border-l border-t border-[color:var(--color-hairline)] text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="border-b border-r border-[color:var(--color-hairline)] px-2 py-1.5 text-muted-foreground"
              >
                {d}
              </div>
            ))}
            {days.map((d) => {
              const list = byDay.get(d.toDateString()) ?? [];
              const inMonth = d.getMonth() === month.getMonth();
              return (
                <div
                  key={d.toISOString()}
                  className={`min-h-[5.5rem] border-b border-r border-[color:var(--color-hairline)] p-1.5 ${inMonth ? "" : "bg-muted/20 text-muted-foreground"}`}
                >
                  <div
                    className={`mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${sameDay(d, today) ? "bg-foreground text-background" : ""}`}
                  >
                    {d.getDate()}
                  </div>
                  {list.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelected(e)}
                      className="flex w-full items-center gap-1 truncate rounded-sm px-1 py-0.5 text-left [@media(hover:hover)]:hover:bg-muted/50"
                      title={e.title}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND[e.kind]?.dot ?? "bg-foreground"}`}
                      />
                      <span className="truncate">
                        <span className="hidden sm:inline">{timeOf(e.starts_at)} </span>
                        {e.title}
                      </span>
                    </button>
                  ))}
                  {list.length > 3 && (
                    <div className="px-1 text-[10px] text-muted-foreground">
                      +{list.length - 3} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            {Object.entries(KIND).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${v.dot}`} /> {v.label}
              </span>
            ))}
          </div>
        </div>

        {/* Selected / upcoming */}
        <div>
          {selected ? (
            <EventDetails
              item={selected}
              onClose={() => setSelected(null)}
              onDelete={removeEvent}
            />
          ) : (
            <>
              <h2 className={label}>Next 60 days</h2>
              {!upcoming ? (
                <Empty>Loading…</Empty>
              ) : upcoming.length === 0 ? (
                <Empty>Nothing scheduled.</Empty>
              ) : (
                <ul className="mt-3 space-y-3">
                  {upcoming.map((e) => (
                    <li key={e.id}>
                      <button
                        onClick={() => setSelected(e)}
                        className="w-full text-left [@media(hover:hover)]:hover:opacity-80"
                      >
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={`h-2 w-2 rounded-full ${KIND[e.kind]?.dot}`} />
                          {dayLabel(e.starts_at)} · {timeOf(e.starts_at)}
                        </div>
                        <div className="mt-0.5 text-sm">{e.title}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function EventDetails({
  item,
  onClose,
  onDelete,
}: {
  item: CalendarItem;
  onClose: () => void;
  onDelete: (item: CalendarItem) => void;
}) {
  const join = item.location?.startsWith("http") ? item.location : null;
  return (
    <div className="border border-[color:var(--color-hairline)] p-5">
      <div className="flex items-start justify-between gap-3">
        <p className={label}>{KIND[item.kind]?.label}</p>
        <button onClick={onClose} className={mutedButton} aria-label="Close details">
          ✕
        </button>
      </div>
      <h3 className="mt-2 text-base font-medium">{item.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {dayLabel(item.starts_at)}, {timeOf(item.starts_at)} – {timeOf(item.ends_at)}
      </p>
      {item.location && !join && <p className="mt-2 text-sm">{item.location}</p>}
      {item.notes && (
        <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{item.notes}</p>
      )}
      <div className="mt-4 flex flex-col items-start gap-2">
        {join && (
          <a href={join} target="_blank" rel="noopener noreferrer" className={primaryButton}>
            Join meeting
          </a>
        )}
        {item.link && (
          <Link to={item.link as LinkProps["to"]} className={linkButton}>
            Open in Savant →
          </Link>
        )}
        <a
          href={googleCalendarUrl(item)}
          target="_blank"
          rel="noopener noreferrer"
          className={linkButton}
        >
          Add to Google Calendar ↗
        </a>
        <button onClick={() => downloadIcs(item)} className={linkButton}>
          Download (.ics) for Outlook or Apple
        </button>
        {item.kind === "event" && (
          <button onClick={() => onDelete(item)} className={mutedButton}>
            Delete event
          </button>
        )}
      </div>
    </div>
  );
}

function AddEvent({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    const starts = new Date(`${date}T${start}`);
    const ends = new Date(`${date}T${end}`);
    if (!title.trim()) return toast.error("Give the event a title.");
    if (!(ends > starts)) return toast.error("The end time must be after the start time.");
    setSaving(true);
    const { error } = await supabase.from("calendar_events").insert({
      owner_id: userId,
      title: title.trim(),
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      location: location.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Event added.");
    onDone();
  }

  const input =
    "mt-1 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-2 text-sm outline-none focus:border-foreground";
  return (
    <form
      onSubmit={save}
      className="mt-6 grid gap-4 border border-[color:var(--color-hairline)] p-5 sm:grid-cols-2"
    >
      <label className="sm:col-span-2">
        <span className={label}>Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className={input}
          placeholder="Intro call with…"
        />
      </label>
      <label>
        <span className={label}>Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={input}
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label>
          <span className={label}>Start</span>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={input}
          />
        </label>
        <label>
          <span className={label}>End</span>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={input}
          />
        </label>
      </div>
      <label className="sm:col-span-2">
        <span className={label}>Location or meeting link</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={500}
          className={input}
          placeholder="https://zoom.us/j/… or an address"
        />
      </label>
      <label className="sm:col-span-2">
        <span className={label}>Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={2}
          className={input}
        />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving ? "Saving…" : "Add event"}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          Only you can see your own events. To schedule a session or interview with someone, use
          Talent &amp; Schedule so they're notified too.
        </p>
      </div>
    </form>
  );
}

function SyncPanel() {
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase
      .from("calendar_feeds")
      .select("token")
      .maybeSingle()
      .then(({ data }) => setToken(data?.token ?? null));
  }, []);

  async function rotate() {
    if (
      token &&
      !window.confirm("Reset the link? Calendars subscribed to the old link stop updating.")
    )
      return;
    const { data, error } = await supabase.rpc("rotate_calendar_feed");
    if (error) return toast.error(error.message);
    setToken(data as string);
  }

  const url = token ? `${window.location.origin}/api/calendar/${token}.ics` : "";
  return (
    <div className="mt-6 border border-[color:var(--color-hairline)] p-5 text-sm">
      <p className="font-medium">Sync to Google, Outlook or Apple Calendar</p>
      <p className="mt-1 text-muted-foreground">
        Subscribe once and your Savant sessions, interviews and events show up in your own calendar,
        updating every few hours. It's one-way: changes go from Savant to your calendar.
      </p>
      {token === undefined ? (
        <p className="mt-3 text-muted-foreground">Loading…</p>
      ) : !token ? (
        <button onClick={rotate} className={`mt-4 ${primaryButton}`}>
          Create my calendar link
        </button>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
              aria-label="Calendar link"
              className="min-w-0 flex-1 border-b border-[color:var(--color-hairline)] bg-transparent py-2 font-mono text-xs"
            />
            <button
              onClick={() =>
                navigator.clipboard.writeText(url).then(() => toast.success("Link copied."))
              }
              className={linkButton}
            >
              Copy
            </button>
            <a href={url.replace(/^https?:/, "webcal:")} className={linkButton}>
              Open in calendar app
            </a>
          </div>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <strong className="font-medium text-foreground">Google Calendar:</strong> Other
              calendars → + → From URL → paste the link.
            </li>
            <li>
              <strong className="font-medium text-foreground">Outlook:</strong> Add calendar →
              Subscribe from web → paste the link.
            </li>
            <li>
              <strong className="font-medium text-foreground">Apple Calendar:</strong> File → New
              Calendar Subscription → paste the link.
            </li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Keep this link private: anyone with it can see your calendar.{" "}
            <button onClick={rotate} className="underline underline-offset-4">
              Reset link
            </button>
          </p>
        </>
      )}
    </div>
  );
}
