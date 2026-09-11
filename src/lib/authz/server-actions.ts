import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["talent", "recruiter", "admin"]),
});

/**
 * Changes a user's role. This is the one place a role is ever assigned
 * outside of signup, and it re-verifies the caller is an admin itself —
 * independently of the RLS policy on user_roles — before touching anything.
 * Two layers have to agree a caller is an admin before this does anything:
 * this check, and the "Admins manage roles" RLS policy the write still has
 * to pass. Neither the request body nor any client-side state factors in.
 */
export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(updateRoleSchema)
  .handler(async ({ data, context }) => {
    const { data: callerRoles, error: callerRolesError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (callerRolesError) throw new Error(callerRolesError.message);

    const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) {
      throw new Error("Forbidden: admin role required");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: deleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (deleteError) throw new Error(deleteError.message);

    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insertError) throw new Error(insertError.message);

    return { userId: data.userId, role: data.role };
  });
