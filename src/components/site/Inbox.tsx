import { Link, type LinkProps } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChipGroup, Empty, SectionHeading, list, mutedButton, timeAgo } from "./ui";

type Message = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

type Filter = "unread" | "forms";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "unread", label: "Unread" },
  { value: "forms", label: "Form submissions" },
];

/**
 * Every notification a user has received, newest first. Notifications are
 * written only by database triggers (applications, invitations, sign-ups,
 * scheduling, and — for admins — every form filled out on the site).
 */
export function Inbox({ userId, isAdmin = false }: { userId: string; isAdmin?: boolean }) {
  const [items, setItems] = useState<Message[] | null>(null);
  const [filters, setFilters] = useState<Filter[]>([]);

  useEffect(() => {
    supabase
      .from("notifications")
      .select("id, kind, title, body, link, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }) => setItems(data ?? []));
  }, [userId]);

  const visible = useMemo(
    () =>
      (items ?? []).filter(
        (m) =>
          (!filters.includes("unread") || !m.read_at) &&
          (!filters.includes("forms") || m.kind.startsWith("admin_")),
      ),
    [items, filters],
  );
  const unread = (items ?? []).filter((m) => !m.read_at);

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    const now = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: now }).in("id", ids);
    setItems(
      (prev) =>
        prev?.map((m) => (ids.includes(m.id) ? { ...m, read_at: m.read_at ?? now } : m)) ?? null,
    );
  }

  return (
    <section>
      <SectionHeading title={`Inbox${unread.length ? ` (${unread.length})` : ""}`}>
        <button
          onClick={() => markRead(unread.map((m) => m.id))}
          disabled={!unread.length}
          className={mutedButton}
        >
          Mark all read
        </button>
      </SectionHeading>
      <div className="mt-6">
        <ChipGroup
          options={isAdmin ? FILTERS : FILTERS.filter((f) => f.value !== "forms")}
          value={filters}
          onChange={setFilters}
        />
      </div>

      {!items ? (
        <Empty>Loading…</Empty>
      ) : visible.length === 0 ? (
        <Empty>{filters.length ? "Nothing matches." : "Your inbox is empty."}</Empty>
      ) : (
        <ul className={`mt-6 ${list}`}>
          {visible.map((m) => (
            <li key={m.id} className="flex gap-4 py-5">
              <span
                aria-label={m.read_at ? "Read" : "Unread"}
                className={`mt-2 h-2 w-2 shrink-0 rounded-full ${m.read_at ? "bg-transparent" : "bg-foreground"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  {m.link ? (
                    <Link
                      to={m.link as LinkProps["to"]}
                      onClick={() => markRead([m.id])}
                      className={`text-base ${m.read_at ? "" : "font-semibold"} [@media(hover:hover)]:hover:underline`}
                    >
                      {m.title}
                    </Link>
                  ) : (
                    <span className={`text-base ${m.read_at ? "" : "font-semibold"}`}>
                      {m.title}
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {timeAgo(m.created_at)}
                  </span>
                </div>
                {m.body && (
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{m.body}</p>
                )}
                {!m.read_at && (
                  <button onClick={() => markRead([m.id])} className={`mt-2 ${mutedButton}`}>
                    Mark read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
