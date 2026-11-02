import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const contextSchema = z.object({
  row: z.number().int().nullish(),
  title: z.string().max(500).nullable(),
  company: z.string().max(300).nullable(),
  url: z.string().max(2000),
  verdict: z.enum(["pass", "no_pass"]),
  score: z.number().int().min(0).max(100),
  confidence: z.string().max(20),
  summary: z.string().max(600),
  signals: z
    .array(
      z.object({
        severity: z.string().max(10),
        text: z.string().max(300),
        evidence: z.string().max(300).optional(),
      }),
    )
    .max(12),
});

const bodySchema = z.object({
  question: z.string().min(1).max(1000),
  context: z.array(contextSchema).min(1).max(60),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(3000) }))
    .max(12)
    .default([]),
});

/** POST /api/coach/chat — ask questions about the results already on screen in Savant Coach. */
export const Route = createFileRoute("/api/coach/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { AutofillError } = await import("@/lib/autofill/autofill.server");
        const { requireCoach, answerCoach } = await import("@/lib/coach/listing.server");
        try {
          await requireCoach(request);
          const parsed = bodySchema.safeParse(await request.json());
          if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
          const { question, context, history } = parsed.data;
          return Response.json({ answer: await answerCoach(question, context, history) });
        } catch (error) {
          if (error instanceof AutofillError)
            return Response.json({ error: error.message }, { status: error.status });
          console.error("[coach/chat]", error);
          return Response.json({ error: "Chat failed" }, { status: 500 });
        }
      },
    },
  },
});
