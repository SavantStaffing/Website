import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DeleteAccount } from "./DeleteAccount";
import { Field, Toggle, primaryButton } from "./ui";
import {
  UsernameField,
  USERNAME_RE,
  profileSaveError,
  usernameOk,
  type UsernameStatus,
} from "./UsernameField";

/** "Account Settings" for talent, recruiters and coaches: notifications,
 *  password, and self-service account deletion. `editName` adds the name
 *  and username (for accounts with no other page to set them, i.e. coaches). */
export function AccountSettings({
  userId,
  editName = false,
  children,
}: {
  userId: string;
  editName?: boolean;
  children?: ReactNode;
}) {
  const [emailNotifications, setEmailNotifications] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  // Google-only accounts have no password yet: offer to set one.
  const [hasPassword, setHasPassword] = useState(true);

  useEffect(() => {
    supabase.rpc("my_has_password").then(({ data }) => setHasPassword(data !== false));
  }, [userId]);

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
    toast.success(
      hasPassword ? "Password updated." : "Password set. You can now sign in with your email too.",
    );
    setHasPassword(true);
  }

  return (
    <section className="space-y-16">
      {editName && <NameAndUsername userId={userId} />}
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
        <h2 className="text-2xl font-semibold">
          {hasPassword ? "Change password" : "Set password"}
        </h2>
        {!hasPassword && (
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            You sign in with Google. Set a password to also sign in with your email.
          </p>
        )}
        <form onSubmit={changePassword} className="mt-8 max-w-md space-y-6">
          <Field
            label={hasPassword ? "New password" : "Password"}
            type="password"
            value={password}
            onChange={setPassword}
          />
          <Field
            label={hasPassword ? "Confirm new password" : "Confirm password"}
            type="password"
            value={confirm}
            onChange={setConfirm}
          />
          <button type="submit" disabled={saving} className={primaryButton}>
            {saving ? "…" : hasPassword ? "Update password" : "Set password"}
          </button>
        </form>
      </div>

      <DeleteAccount />
    </section>
  );
}

function NameAndUsername({ userId }: { userId: string }) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name ?? "");
        setUsername(data?.username ?? "");
        setCurrent(data?.username ?? null);
      });
  }, [userId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const name = fullName.trim();
    const handle = username.trim();
    if (name.length < 2 || name.length > 100) return toast.error("Enter your full name.");
    const changed = handle.toLowerCase() !== (current ?? "").toLowerCase();
    if (changed && !USERNAME_RE.test(handle))
      return toast.error("Usernames are 2–40 letters, numbers, dots, dashes or underscores.");
    if (changed && !usernameOk(status))
      return toast.error(
        status === "taken"
          ? "That username is taken. Pick another one."
          : "Still checking your username.",
      );
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, username: handle })
      .eq("id", userId);
    setSaving(false);
    if (error) return toast.error(profileSaveError(error));
    setCurrent(handle);
    toast.success("Saved.");
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold">Name and username</h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Your full name is what talent and the Savant team see. Your username is a unique handle.
      </p>
      <form onSubmit={save} className="mt-8 max-w-md space-y-6">
        <Field label="Full name" value={fullName} onChange={setFullName} />
        <UsernameField
          value={username}
          onChange={setUsername}
          onStatus={setStatus}
          current={current}
        />
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving ? "…" : "Save"}
        </button>
      </form>
    </div>
  );
}
