import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Help page → assistant. Signed-in users only; limits are enforced in the database. */
export const askHelp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      question: z.string().trim().min(2).max(800),
      history: z
        .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
        .max(12)
        .default([]),
      asRole: z.enum(["talent", "recruiter", "coach"]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { answerHelp } = await import("./help.server");
    return answerHelp(context.supabase, context.userId, data);
  });
