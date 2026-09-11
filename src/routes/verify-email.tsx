import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Verify email — Savant Staffing" },
      { name: "description", content: "Verify your email address." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setVerified(!!data.user?.email_confirmed_at);
      if (data.user?.email_confirmed_at) {
        setTimeout(() => {
          if (target) window.location.replace(target);
          else navigate({ to: "/dashboard", replace: true });
        }, 1500);
      }
    })();
  }, [navigate, target]);

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-6 text-center">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Verification</p>
        <h1 className="mt-6 text-4xl font-semibold leading-tight">
          {verified === null ? "Confirming…" : verified ? "Email verified." : "Almost there."}
        </h1>
        <p className="mt-6 text-sm text-muted-foreground">
          {verified === null
            ? "Checking your session."
            : verified
              ? "Redirecting you to your hub."
              : "Click the link we sent to your email to complete verification. You can close this tab once done."}
        </p>
        {verified === false && (
          <Link
            to="/auth"
            search={{ mode: "login" }}
            className="mt-8 inline-block border-b border-foreground pb-1 text-[12px] uppercase tracking-[0.2em]"
          >
            Return to sign in
          </Link>
        )}
      </div>
    </div>
  );
}
