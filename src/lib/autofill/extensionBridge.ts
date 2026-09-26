import { supabase } from "@/integrations/supabase/client";

/**
 * Hands the signed-in talent's session token to the Savant Apply browser
 * extension (extension/background.js), so it can call /api/autofill/* as
 * them. No-op unless VITE_SAVANT_APPLY_EXTENSION_ID is set and the browser
 * exposes chrome.runtime (Chrome/Edge with the extension installed).
 *
 * Returns an unsubscribe function.
 */
export function connectSavantApplyExtension(): () => void {
  const extensionId = import.meta.env.VITE_SAVANT_APPLY_EXTENSION_ID as string | undefined;
  const runtime = (
    globalThis as { chrome?: { runtime?: { sendMessage?: (...args: unknown[]) => void } } }
  ).chrome?.runtime;
  if (!extensionId || !runtime?.sendMessage) return () => {};

  const push = (token: string | null) => {
    try {
      runtime.sendMessage!(extensionId, { type: "session", token }, () => void 0);
    } catch {
      // Extension not installed — nothing to do.
    }
  };

  supabase.auth.getSession().then(({ data }) => push(data.session?.access_token ?? null));
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    push(session?.access_token ?? null),
  );
  return () => data.subscription.unsubscribe();
}
