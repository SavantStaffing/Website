import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Applications → "Add a job by link". Reads the posting's title and company
 * from the page and adds it to the talent's list. The insert runs as the
 * signed-in user, so Row Level Security decides whether it's allowed.
 */
export const addApplicationByUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ url: z.string().trim().url().max(2000) }))
  .handler(async ({ data, context }) => {
    const { addByUrl } = await import("./applications.server");
    return addByUrl(context.supabase, context.userId, data.url);
  });
