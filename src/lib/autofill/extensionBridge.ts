import { supabase } from "@/integrations/supabase/client";
import { SAVANT_APPLY_EXTENSION_ID } from "./extension";

/**
 * Hands the signed-in talent's session token to the Savant Apply browser
 * extension (extension/background.js), so it can call /api/autofill/* as
 * them. No-op unless the browser exposes chrome.runtime, which Chrome/Edge
 * only do on this site when the extension is installed.
 *
 * Returns an unsubscribe function.
 */
export function connectSavantApplyExtension(): () => void {
  const runtime = (
    globalThis as {
      chrome?: {
        runtime?: { sendMessage?: (...args: unknown[]) => void; lastError?: unknown };
      };
    }
  ).chrome?.runtime;
  if (!runtime?.sendMessage) return () => {};

  const push = (token: string | null) => {
    try {
      // Reading lastError keeps Chrome from logging "no such extension".
      runtime.sendMessage!(
        SAVANT_APPLY_EXTENSION_ID,
        { type: "session", token },
        () => void runtime.lastError,
      );
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
