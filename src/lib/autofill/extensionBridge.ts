import { supabase } from "@/integrations/supabase/client";
import { SAVANT_APPLY_EXTENSION_IDS } from "./extension";

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

  // Sent to every known ID (store listing and download); only the installed
  // copy answers.
  const push = (token: string | null) => {
    for (const id of SAVANT_APPLY_EXTENSION_IDS) {
      try {
        // Reading lastError keeps Chrome from logging "no such extension".
        runtime.sendMessage!(id, { type: "session", token }, () => void runtime.lastError);
      } catch {
        // Not installed under this ID — nothing to do.
      }
    }
  };

  supabase.auth.getSession().then(({ data }) => push(data.session?.access_token ?? null));
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    push(session?.access_token ?? null),
  );
  return () => data.subscription.unsubscribe();
}
