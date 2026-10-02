import { useCallback, useEffect, useState } from "react";
import { detectJob } from "./mapper";

/**
 * The Savant Apply browser extension (extension/), as seen from the site:
 * whether this browser can run it, whether it's installed and connected,
 * which jobs it can fill, and the talent's "always autofill" choice.
 */

/**
 * Every ID Savant Apply can have, most preferred first:
 * - the Chrome Web Store listing, which assigns its own ID (add it to
 *   STORE_ID once published, or set VITE_SAVANT_APPLY_EXTENSION_ID);
 * - the /autofill download, whose ID is fixed by the public "key" in
 *   extension/manifest.json.
 */
const STORE_ID = "";
const DOWNLOAD_ID = "pagkblcgfhpdjohmlcmalhcpnlkpbhao";
export const SAVANT_APPLY_EXTENSION_IDS = [
  ...new Set(
    [
      import.meta.env.VITE_SAVANT_APPLY_EXTENSION_ID as string | undefined,
      STORE_ID,
      DOWNLOAD_ID,
    ].filter((id): id is string => !!id),
  ),
];

export const SAVANT_APPLY_DOWNLOAD = "/downloads/savant-apply.zip";

/** Application sites the extension can fill (content_scripts in the manifest). */
export const AUTOFILL_ATS_LABEL: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workday: "Workday",
};

type ChromeRuntime = {
  sendMessage?: (id: string, msg: unknown, cb: (res: unknown) => void) => void;
  lastError?: unknown;
};
const runtime = (): ChromeRuntime | undefined =>
  (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;

/** Chrome, Edge, Brave, Arc… on a computer. Extensions don't run on phones. */
export function isSupportedBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return false;
  const brands = (navigator as { userAgentData?: { brands?: { brand: string }[] } }).userAgentData
    ?.brands;
  if (brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand))) return true;
  return /Chrome\/|Edg\//.test(ua) && !/OPR\//.test(ua);
}

export type ExtensionStatus =
  | { state: "checking" }
  | { state: "unsupported" } // not a desktop Chromium browser
  | { state: "missing" }
  | { state: "installed"; version: string; connected: boolean };

function pingOne(rt: ChromeRuntime, id: string, timeoutMs: number): Promise<ExtensionStatus> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ state: "missing" }), timeoutMs);
    try {
      rt.sendMessage!(id, { type: "ping" }, (res) => {
        clearTimeout(timer);
        const r = res as { ok?: boolean; version?: string; connected?: boolean } | undefined;
        // Reading lastError tells Chrome we handled "no such extension".
        if (rt.lastError || !r?.ok) return resolve({ state: "missing" });
        resolve({ state: "installed", version: r.version ?? "?", connected: !!r.connected });
      });
    } catch {
      clearTimeout(timer);
      resolve({ state: "missing" });
    }
  });
}

/** Asks each known Savant Apply ID whether it's installed. Chrome only exposes
 *  chrome.runtime to pages an installed extension lists in externally_connectable. */
export async function pingExtension(timeoutMs = 1500): Promise<ExtensionStatus> {
  if (!isSupportedBrowser()) return { state: "unsupported" };
  const rt = runtime();
  if (!rt?.sendMessage) return { state: "missing" };
  const results = await Promise.all(
    SAVANT_APPLY_EXTENSION_IDS.map((id) => pingOne(rt, id, timeoutMs)),
  );
  return results.find((r) => r.state === "installed") ?? { state: "missing" };
}

/** Live extension status, with a `recheck` for "I've installed it". */
export function useSavantApply() {
  const [status, setStatus] = useState<ExtensionStatus>({ state: "checking" });
  const recheck = useCallback(async () => {
    setStatus({ state: "checking" });
    setStatus(await pingExtension());
  }, []);
  useEffect(() => {
    void recheck();
  }, [recheck]);
  return { status, recheck };
}

/** The application site's name if Savant Apply can fill this job's form. */
export function autofillAtsFor(url: string | null | undefined): string | null {
  const ats = url ? detectJob(url)?.ats : null;
  return ats && AUTOFILL_ATS_LABEL[ats] ? ats : null;
}

/**
 * Where to send the talent when they choose autofill: straight to the form
 * (Lever and Ashby put it on a separate step) with #savant-autofill, which
 * tells the extension to fill as soon as the form loads.
 */
export function autofillUrl(url: string): string {
  const u = new URL(url);
  const ats = autofillAtsFor(url);
  const path = u.pathname.replace(/\/+$/, "");
  if (ats === "lever" && !path.endsWith("/apply")) u.pathname = `${path}/apply`;
  if (ats === "ashby" && !path.endsWith("/application")) u.pathname = `${path}/application`;
  u.hash = "savant-autofill";
  return u.toString();
}

const ALWAYS_KEY = "savant-apply:always";

/** "Always autofill when available". Per browser, like the extension itself. */
export function getAlwaysAutofill(): boolean {
  try {
    return localStorage.getItem(ALWAYS_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAlwaysAutofill(on: boolean): void {
  try {
    if (on) localStorage.setItem(ALWAYS_KEY, "1");
    else localStorage.removeItem(ALWAYS_KEY);
  } catch {
    // Storage blocked (private window); the choice just won't be remembered.
  }
}
