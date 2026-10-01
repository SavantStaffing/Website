import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Permanently deletes a user's account and personal data (Settings → Delete
 * account). Most data goes with the auth user through ON DELETE CASCADE (see
 * supabase/migrations/20260930000000_account_deletions.sql); this removes
 * what isn't linked by a foreign key first — résumé files and contact-form
 * messages — then the user, then logs the request without identifying them.
 *
 * Callers must pass the *verified* user id (requireSupabaseAuth).
 */
export async function deleteAccount(uid: string): Promise<{ resumeFilesRemoved: number }> {
  const { data: roleRows, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", uid);
  if (rolesError) throw new Error(rolesError.message);
  const roles = (roleRows ?? []).map((r) => String(r.role));

  // Never leave the site without an admin.
  if (roles.includes("admin")) {
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1)
      throw new Error(
        "You're the only admin. Make someone else an admin before deleting this account.",
      );
  }

  const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(uid);
  if (userError || !user?.user) throw new Error("Account not found");
  const email = user.user.email;

  // Résumé files live in resumes/<uid>/…, outside the cascade.
  let resumeFilesRemoved = 0;
  for (;;) {
    const { data: files, error } = await supabaseAdmin.storage
      .from("resumes")
      .list(uid, { limit: 100 });
    if (error) throw new Error(`Couldn't remove résumé files: ${error.message}`);
    if (!files?.length) break;
    const paths = files.map((f) => `${uid}/${f.name}`);
    const { error: removeError } = await supabaseAdmin.storage.from("resumes").remove(paths);
    if (removeError) throw new Error(`Couldn't remove résumé files: ${removeError.message}`);
    resumeFilesRemoved += paths.length;
    if (files.length < 100) break;
  }

  // Contact-form messages are matched by email, not linked to the account.
  if (email) {
    const { error } = await supabaseAdmin.from("contact_messages").delete().ilike("email", email);
    if (error) throw new Error(`Couldn't remove contact messages: ${error.message}`);
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(uid);
  if (deleteError) throw new Error(`Couldn't delete the account: ${deleteError.message}`);

  // Record of the request, with nothing that identifies the person. Best
  // effort: the account is already gone if this fails.
  const { error: logError } = await supabaseAdmin
    .from("account_deletions")
    .insert({ roles, resume_files_removed: resumeFilesRemoved });
  if (logError) console.error("[account] deletion log failed:", logError.message);

  return { resumeFilesRemoved };
}
