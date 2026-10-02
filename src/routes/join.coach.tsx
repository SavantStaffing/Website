import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PasswordInput } from "@/components/site/PasswordInput";

/**
 * Career coach sign-up. Not linked from anywhere on the site: admins create
 * invite links on /admin/coach-invites and send them to coaches. The invite
 * code is what grants the role (checked in handle_new_user), so a copied
 * URL without a live code only ever creates a talent account.
 */
export const Route = createFileRoute("/join/coach")({
  validateSearch: (s: Record<string, unknown>) => ({
    invite: typeof s.invite === "string" ? s.invite : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Coach sign up — Savant Staffing" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CoachSignup,
});

const schema = z.object({
  username: z.string().trim().min(2, "Name must be at least 2 characters").max(40),
  email: z.string().trim().email("Enter a valid email").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

type InviteStatus = "checking" | "valid" | "invalid" | "revoked" | "expired" | "used";

const PROBLEM: Record<Exclude<InviteStatus, "checking" | "valid">, string> = {
  invalid: "This invite link isn't valid. Check that you copied the whole link.",
  revoked: "This invite link has been withdrawn.",
  expired: "This invite link has expired.",
  used: "This invite link has already been used.",
};

function CoachSignup() {
  const { invite } = Route.useSearch();
  const [status, setStatus] = useState<InviteStatus>("checking");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!invite) return setStatus("invalid");
    supabase.rpc("coach_invite_status", { _code: invite }).then(({ data, error }) => {
      setStatus(error ? "invalid" : ((data as InviteStatus) ?? "invalid"));
    });
  }, [invite]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ username, email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    setLoading(true);
    // Re-check right before signing up: an account made with a dead invite
    // would silently become a talent account.
    const { data: live } = await supabase.rpc("coach_invite_status", { _code: invite! });
    if (live !== "valid") {
      setLoading(false);
      return setStatus((live as InviteStatus) ?? "invalid");
    }
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/verify-email?next=${encodeURIComponent("/coach")}`,
        data: { username: parsed.data.username, role: "career_coach", coach_invite: invite },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
  }

  return (
    <div className="mx-auto grid min-h-[80vh] max-w-md place-items-center px-6 py-16">
      <div className="w-full">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Career coach</p>
        <h1 className="mt-6 text-4xl font-semibold leading-tight">Coach with Savant.</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Create your coach account to receive Preparation service requests: career programs, résumé
          building and interview development.
        </p>

        <div className="mt-10">
          {status === "checking" ? (
            <p className="text-sm text-muted-foreground">Checking your invite…</p>
          ) : sent ? (
            <div className="rounded-sm border border-[color:var(--color-hairline)] p-6">
              <h2 className="text-lg font-medium">Check your email</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                We sent a confirmation link to <span className="text-foreground">{email}</span>.
                Click it to verify, and you'll land on your coach dashboard.
              </p>
            </div>
          ) : status !== "valid" ? (
            <div className="rounded-sm border border-[color:var(--color-hairline)] p-6">
              <h2 className="text-lg font-medium">Invite needed</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {PROBLEM[status]} Ask Savant for a new link at{" "}
                <a
                  href="mailto:info@savantalent.com"
                  className="text-foreground underline underline-offset-4"
                >
                  info@savantalent.com
                </a>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <Field label="Name" value={username} onChange={setUsername} autoComplete="name" />
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-sm bg-foreground py-3 text-[12px] font-medium uppercase tracking-[0.2em] text-background disabled:opacity-50"
              >
                {loading ? "…" : "Create coach account"}
              </button>
            </form>
          )}
        </div>

        <div className="mt-10 text-[12px] uppercase tracking-[0.2em] text-muted-foreground">
          <Link
            to="/auth"
            search={{ mode: "login" }}
            className="[@media(hover:hover)]:hover:text-foreground"
          >
            Already have an account? Log in
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      {type === "password" ? (
        <span className="mt-2 block">
          <PasswordInput
            value={value}
            onChange={onChange}
            autoComplete={autoComplete}
            required
            className="block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-3 text-base outline-none focus:border-foreground"
          />
        </span>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="mt-2 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-3 text-base outline-none focus:border-foreground"
        />
      )}
    </label>
  );
}
