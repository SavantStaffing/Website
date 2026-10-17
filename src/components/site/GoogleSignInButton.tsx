import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Google's own "Sign in with Google" button (Google Identity Services).
 *
 *  Google verifies the person in a popup on our domain and hands back an ID
 *  token, which Supabase exchanges for a session. Because the sign-in never
 *  redirects through <project>.supabase.co, Google's screen names our site
 *  ("to continue to savantalent.com") instead of the Supabase address.
 *
 *  A one-time nonce ties each token to this page: Google gets its SHA-256
 *  hash, Supabase gets the raw value and checks they match. */

type GoogleId = {
  initialize: (options: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";
let gisLoading: Promise<GoogleId> | null = null;

function loadGoogleIdentity(): Promise<GoogleId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  gisLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error("Google sign-in didn't load"));
    };
    script.onerror = () => {
      gisLoading = null;
      reject(new Error("Google sign-in couldn't load. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function GoogleSignInButton({
  clientId,
  theme = "outline",
  onSignedIn,
  onError,
}: {
  clientId: string;
  theme?: "outline" | "filled_black" | "filled_blue";
  onSignedIn: () => void;
  onError: (message: string) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  // Keep the latest callbacks without re-rendering Google's button.
  const callbacks = useRef({ onSignedIn, onError });
  callbacks.current = { onSignedIn, onError };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const google = await loadGoogleIdentity();
        if (cancelled || !holder.current) return;
        const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
        google.initialize({
          client_id: clientId,
          nonce: await sha256Hex(nonce),
          ux_mode: "popup",
          use_fedcm_for_button: true,
          callback: async ({ credential }: { credential: string }) => {
            setBusy(true);
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: credential,
              nonce,
            });
            setBusy(false);
            if (error) callbacks.current.onError(error.message);
            else callbacks.current.onSignedIn();
          },
        });
        const width = Math.min(400, holder.current.parentElement?.clientWidth ?? 400);
        google.renderButton(holder.current, {
          type: "standard",
          theme,
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "center",
          width,
        });
      } catch (e) {
        if (!cancelled) callbacks.current.onError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, theme]);

  return (
    <div className="flex min-h-[44px] flex-col items-center">
      <div ref={holder} className={busy ? "pointer-events-none opacity-50" : undefined} />
      {busy && <p className="mt-3 text-sm text-muted-foreground">Signing you in…</p>}
    </div>
  );
}
