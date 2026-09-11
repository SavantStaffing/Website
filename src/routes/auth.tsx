import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

type Mode = "login" | "signup" | "forgot";
type SignupRole = "job_seeker" | "recruiter";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode as Mode) ?? "login",
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Savant Staffing" },
      { name: "description", content: "Sign in or create an account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(6).max(128),
});
const signupSchema = loginSchema.extend({
  username: z.string().trim().min(2).max(40),
  role: z.enum(["job_seeker", "recruiter"]),
});

/** Only same-origin relative paths are honored as post-login redirects. */
function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

function useNextTarget() {
  const { next } = Route.useSearch();
  return safeNext(next);
}

function AuthPage() {
  const { mode } = Route.useSearch();
  const next = useNextTarget();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      supabase.auth.getUser().then(({ data }) => {
        if (!data.user) return;
        if (next) window.location.replace(next);
        else navigate({ to: "/hub", replace: true });
      });
    } catch (error) {
      console.error(error);
    }
  }, [navigate, next]);

  return (
    <div className="mx-auto grid min-h-[80vh] max-w-md place-items-center px-6 py-16">
      <div className="w-full">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          {mode === "signup" ? "Create account" : mode === "forgot" ? "Recover" : "Sign in"}
        </p>
        <h1 className="mt-6 text-4xl font-semibold leading-tight">
          {mode === "signup"
            ? "Join Savant."
            : mode === "forgot"
              ? "Reset your password."
              : "Welcome back."}
        </h1>

        <div className="mt-10">
          {mode === "signup" && <SignupForm />}
          {mode === "login" && <LoginForm />}
          {mode === "forgot" && <ForgotForm />}
        </div>

        {mode !== "forgot" && (
          <>
            <div className="my-8 flex items-center gap-4 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              <div className="h-px flex-1 bg-[color:var(--color-hairline)]" />
              or
              <div className="h-px flex-1 bg-[color:var(--color-hairline)]" />
            </div>
            <GoogleButton />
          </>
        )}

        <div className="mt-10 flex flex-wrap gap-6 text-[12px] uppercase tracking-[0.2em] text-muted-foreground">
          {mode !== "login" && (
            <Link to="/auth" search={{ mode: "login" }} className="[@media(hover:hover)]:hover:text-foreground">
              Log in
            </Link>
          )}
          {mode !== "signup" && (
            <Link to="/auth" search={{ mode: "signup" }} className="[@media(hover:hover)]:hover:text-foreground">
              Sign up
            </Link>
          )}
          {mode !== "forgot" && (
            <Link to="/auth" search={{ mode: "forgot" }} className="[@media(hover:hover)]:hover:text-foreground">
              Forgot password?
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const next = useNextTarget();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed in.");
    if (next) window.location.assign(next);
    else navigate({ to: "/hub" });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />
      <SubmitBtn loading={loading}>Sign in</SubmitBtn>
    </form>
  );
}

function SignupForm() {
  const next = useNextTarget();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<SignupRole>("job_seeker");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ email, password, username, role });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/verify-email${next ? `?next=${encodeURIComponent(next)}` : ""}`,
        data: { username: parsed.data.username, role: parsed.data.role },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-sm border border-[color:var(--color-hairline)] p-6">
        <h2 className="text-lg font-medium">Check your email</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          We sent a confirmation link to <span className="text-foreground">{email}</span>.
          Click the link to verify and finish signing up.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          I am a...
        </span>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <RoleOption
            label="Job Seeker"
            selected={role === "job_seeker"}
            onClick={() => setRole("job_seeker")}
          />
          <RoleOption
            label="Recruiter"
            selected={role === "recruiter"}
            onClick={() => setRole("recruiter")}
          />
        </div>
      </div>
      <Field label="Username" value={username} onChange={setUsername} autoComplete="username" />
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
      />
      <SubmitBtn loading={loading}>Create account</SubmitBtn>
    </form>
  );
}

function RoleOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm border px-4 py-3 text-sm transition-colors ${
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-[color:var(--color-hairline)] text-muted-foreground [@media(hover:hover)]:hover:border-foreground [@media(hover:hover)]:hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function ForgotForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().trim().email().max(254).safeParse(email);
    if (!parsed.success) {
      toast.error("Enter a valid email");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-sm border border-[color:var(--color-hairline)] p-6">
        <h2 className="text-lg font-medium">Check your email</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          If an account exists for {email}, you'll get a reset link shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <SubmitBtn loading={loading}>Send reset link</SubmitBtn>
    </form>
  );
}

function GoogleButton() {
  const next = useNextTarget();
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri:
        window.location.origin +
        "/auth/callback" +
        (next ? `?next=${encodeURIComponent(next)}` : ""),
    });
    if (result.error) {
      setLoading(false);
      toast.error("Google sign-in failed");
    }
  }
  return (
    <button
      type="button"
      onClick={go}
      disabled={loading}
      className="w-full rounded-sm border border-foreground py-3 text-[12px] font-medium uppercase tracking-[0.2em] [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background active:bg-foreground active:text-background transition-colors disabled:opacity-50"
    >
      {loading ? "…" : "Continue with Google"}
    </button>
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
      <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="mt-2 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-3 text-base outline-none focus:border-foreground"
      />
    </label>
  );
}

function SubmitBtn({
  children,
  loading,
}: {
  children: React.ReactNode;
  loading: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-2 w-full rounded-sm bg-foreground py-3 text-[12px] font-medium uppercase tracking-[0.2em] text-background disabled:opacity-50"
    >
      {loading ? "…" : children}
    </button>
  );
}
