import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const fieldSchema = z.object({
  key: z.string().min(1).max(300),
  label: z.string().max(1000),
  type: z.enum(["text", "textarea", "file", "select", "multiselect", "checkbox"]),
  required: z.boolean().optional(),
  options: z
    .array(z.object({ label: z.string().max(500), value: z.string().max(500) }))
    .max(500)
    .optional(),
  section: z.enum(["standard", "custom", "eeo"]).optional(),
});

const bodySchema = z.object({
  job_url: z.string().url().max(2000),
  fields: z.array(fieldSchema).max(300),
  job_description: z.string().max(20000).nullable().optional(),
});

/** POST /api/autofill/plan — the Savant Apply extension asks how to fill the form it's looking at. */
export const Route = createFileRoute("/api/autofill/plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { AutofillError, userFromRequest, createPlan } =
          await import("@/lib/autofill/autofill.server");
        try {
          const uid = await userFromRequest(request);
          const parsed = bodySchema.safeParse(await request.json());
          if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
          return Response.json(await createPlan(uid, parsed.data));
        } catch (error) {
          if (error instanceof AutofillError)
            return Response.json({ error: error.message }, { status: error.status });
          console.error("[autofill/plan]", error);
          return Response.json({ error: "Autofill failed" }, { status: 500 });
        }
      },
    },
  },
});
