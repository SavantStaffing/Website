import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  job_url: z.string().url().max(2000),
  answers: z
    .array(z.object({ label: z.string().max(1000), answer: z.string().max(10000) }))
    .max(300),
  // False for one step of a multi-step form. Older extension versions leave it out.
  submitted: z.boolean().optional(),
});

/**
 * POST /api/autofill/answers — remember the candidate's answers for next time.
 * Sent on submit, and after each step of a multi-step form (Workday).
 */
export const Route = createFileRoute("/api/autofill/answers")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { AutofillError, userFromRequest, saveAnswers } =
          await import("@/lib/autofill/autofill.server");
        try {
          const uid = await userFromRequest(request);
          const parsed = bodySchema.safeParse(await request.json());
          if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
          return Response.json(await saveAnswers(uid, parsed.data));
        } catch (error) {
          if (error instanceof AutofillError)
            return Response.json({ error: error.message }, { status: error.status });
          console.error("[autofill/answers]", error);
          return Response.json({ error: "Could not save answers" }, { status: 500 });
        }
      },
    },
  },
});
