import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Settings → Delete account. Deletes the signed-in user's account and data
 * immediately; the typed "DELETE" is checked again here, not just in the UI.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ confirm: z.literal("DELETE") }))
  .handler(async ({ context }) => {
    const { deleteAccount } = await import("./account.server");
    return deleteAccount(context.userId);
  });
