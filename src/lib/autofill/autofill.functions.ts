import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** In-site readiness check for the talent feed ("you can answer 5 of 6 required questions"). */
export const getAutofillReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ jobUrl: z.string().url().max(2000) }))
  .handler(async ({ data, context }) => {
    const { readiness } = await import("./autofill.server");
    return readiness(context.userId, data.jobUrl);
  });
