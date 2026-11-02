import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const text = (max: number) => z.string().max(max).nullish();

const itemSchema = z.object({
  url: z.string().url().max(2000),
  title: text(500),
  company: text(300),
  location: text(300),
  description: text(30000),
  posted_at: text(60),
  valid_through: text(60),
  closed_banner: text(400),
  apply_control: z.boolean().nullish(),
  posted_text: text(200),
  reposted: z.boolean().optional(),
  read_from: z.enum(["page", "sheet"]),
  row: z.number().int().min(0).max(100000).optional(),
});

const bodySchema = z.object({
  listings: z.array(itemSchema).min(1).max(25),
  force: z.boolean().optional(),
});

/** POST /api/coach/check — the Savant Coach extension asks "pass or no pass?" for one or more listings. */
export const Route = createFileRoute("/api/coach/check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { AutofillError } = await import("@/lib/autofill/autofill.server");
        const { requireCoach, checkListings } = await import("@/lib/coach/listing.server");
        try {
          const coachId = await requireCoach(request);
          const parsed = bodySchema.safeParse(await request.json());
          if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
          const results = await checkListings(coachId, parsed.data.listings, parsed.data.force);
          return Response.json({ results });
        } catch (error) {
          if (error instanceof AutofillError)
            return Response.json({ error: error.message }, { status: error.status });
          console.error("[coach/check]", error);
          return Response.json({ error: "Check failed" }, { status: 500 });
        }
      },
    },
  },
});
