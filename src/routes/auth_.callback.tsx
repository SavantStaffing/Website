import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth_/callback")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  head: () => ({
    meta: [{ title: "Signing you in…" }, { name: "robots", content: "noindex" }],
  }),
  component: Callback,
});

/** Plain-language version of what the sign-in service sent back. */
function describeOAuthError(raw: string): string {
  const text = raw.replace(/\+/g, " ");
  if (/provider .*not supported|not enabled/i.test(text))
    return "Google sign-in isn't turned on for Savant yet. Please sign in with your email and password for now.";
  if (/access_denied|cancel/i.test(text)) return "Google sign-in was cancelled.";
  return `Google sign-in didn't complete: ${text}`;
}

function Callback() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The sign-in service reports problems (and sometimes the session) in
      // the URL fragment: #error=…&error_description=… or #access_token=….
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const oauthError = hash.get("error_description") || hash.get("error");
      if (oauthError) {
        setError(describeOAuthError(oauthError));
        return;
      }
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        // Don't leave tokens in the address bar or browser history.
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      // Session may take a tick to hydrate after OAuth
      for (let i = 0; i < 10; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (cancelled) return;
          if (target) window.location.replace(target);
          else navigate({ to: "/dashboard", replace: true });
          return;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!cancelled) setError("Sign-in didn't complete. Please try again.");
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, target]);

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-6">
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          {error ? "Sign in" : "Please wait"}
        </p>
        <h1 className="mt-4 text-2xl font-semibold">
          {error ? "Sign-in failed" : "Signing you in…"}
        </h1>
        {error && (
          <>
            <p className="mt-4 text-sm text-muted-foreground">{error}</p>
            <Link
              to="/auth"
              search={{ mode: "login" }}
              className="mt-8 inline-block border-b border-foreground pb-1 text-[12px] uppercase tracking-[0.2em]"
            >
              Try again
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
