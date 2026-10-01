import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DeleteAccount } from "./DeleteAccount";
import { Field, Toggle, primaryButton } from "./ui";

/** "Account Settings" for talent, recruiters and coaches: notifications,
 *  password, and self-service account deletion. */
export function AccountSettings({ userId, children }: { userId: string; children?: ReactNode }) {
  const [emailNotifications, setEmailNotifications] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("email_notifications")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => setEmailNotifications(data?.email_notifications ?? true));
  }, [userId]);

  async function toggleNotifications(v: boolean) {
    setEmailNotifications(v);
    const { error } = await supabase
      .from("profiles")
      .update({ email_notifications: v })
      .eq("id", userId);
    if (error) {
      setEmailNotifications(!v);
      toast.error(error.message);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Use at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords don't match.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return toast.error(error.message);
    setPassword("");
    setConfirm("");
    toast.success("Password updated.");
  }

  return (
    <section className="space-y-16">
      <div>
        <h2 className="text-2xl font-semibold">Notifications</h2>
        <div className="mt-6 max-w-xl">
          {emailNotifications === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Toggle
              checked={emailNotifications}
              onChange={toggleNotifications}
              label="Email me about activity"
              description="Invitations, application updates, and replies. In-app notifications are always on."
            />
          )}
        </div>
      </div>

      {children}

      <div>
        <h2 className="text-2xl font-semibold">Change password</h2>
        <form onSubmit={changePassword} className="mt-8 max-w-md space-y-6">
          <Field label="New password" type="password" value={password} onChange={setPassword} />
          <Field
            label="Confirm new password"
            type="password"
            value={confirm}
            onChange={setConfirm}
          />
          <button type="submit" disabled={saving} className={primaryButton}>
            {saving ? "…" : "Update password"}
          </button>
        </form>
      </div>

      <DeleteAccount />
    </section>
  );
}
