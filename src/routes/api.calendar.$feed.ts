import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/calendar/<token>.ics — a person's Savant calendar as an iCalendar
 * feed, for subscribing from Google Calendar, Outlook or Apple Calendar.
 * The token is the only credential (Calendar page → "Sync to your calendar";
 * resetting it there stops the old link). Read-only: sessions, interviews and
 * personal events from 60 days ago to a year ahead.
 */
export const Route = createFileRoute("/api/calendar/$feed")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.feed ?? "").replace(/\.ics$/i, "");
        if (!/^[a-f0-9]{64}$/.test(token)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { toIcs } = await import("@/lib/calendar/ics");
        const { data: feed } = await supabaseAdmin
          .from("calendar_feeds")
          .select("user_id")
          .eq("token", token)
          .maybeSingle();
        if (!feed) return new Response("Not found", { status: 404 });

        const now = Date.now();
        const { data, error } = await supabaseAdmin.rpc("calendar_events_for", {
          _uid: feed.user_id,
          _from: new Date(now - 60 * 86_400_000).toISOString(),
          _to: new Date(now + 365 * 86_400_000).toISOString(),
        });
        if (error) {
          console.error("[calendar feed]", error);
          return new Response("Calendar unavailable", { status: 500 });
        }
        return new Response(toIcs(data ?? [], "Savant"), {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="savant.ics"',
            "Cache-Control": "private, max-age=900",
            "X-Robots-Tag": "noindex",
          },
        });
      },
    },
  },
});
