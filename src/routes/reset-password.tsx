import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Savant Staffing" },
      { name: "description", content: "Set a new password for your account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase adds `type=recovery` in the URL hash; wait for session to hydrate
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().min(6).max(128).safeParse(password);
    if (!parsed.success) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    navigate({ to: "/hub" });
  }

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-6">
      <div className="w-full">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Recovery
        </p>
        <h1 className="mt-6 text-4xl font-semibold leading-tight">Set a new password.</h1>

        {!ready ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Waiting for a valid recovery link. Please click the link from your email.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-10 space-y-5">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                New password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="mt-2 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-3 text-base outline-none focus:border-foreground"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                Confirm password
              </span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="mt-2 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-3 text-base outline-none focus:border-foreground"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-sm bg-foreground py-3 text-[12px] font-medium uppercase tracking-[0.2em] text-background disabled:opacity-50"
            >
              {loading ? "…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
