import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled Job Scout runs. Anything that can send an HTTP POST on a timer
 * can drive this — Supabase pg_cron + pg_net, a GitHub Action, cron-job.org.
 * See docs/job-scout.md for the pg_cron snippet.
 *
 *   POST /api/scout/run
 *   Authorization: Bearer <SCOUT_CRON_SECRET>
 */
export const Route = createFileRoute("/api/scout/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.SCOUT_CRON_SECRET;
        if (!secret) {
          return Response.json({ error: "SCOUT_CRON_SECRET is not configured" }, { status: 503 });
        }
        const auth = request.headers.get("authorization") ?? "";
        if (!timingSafeEqual(auth, `Bearer ${secret}`)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { runAndRecord } = await import("@/lib/scout/store.server");
        try {
          const { runId, summary } = await runAndRecord({
            trigger: "scheduled",
            triggeredBy: null,
          });
          return Response.json({ runId, status: summary.status, totals: summary.totals });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Scout run failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
