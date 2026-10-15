import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const KEY = "savant:cookie-notice-dismissed";

/**
 * Plain disclosure that the site only uses essential browser storage.
 * There is nothing to opt out of (no analytics or advertising cookies), so this is a
 * notice with a dismiss button, not a consent gate. If non-essential tracking is ever
 * added, replace this with real accept/decline controls and load nothing until accepted.
 */
export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, new Date().toISOString());
    } catch {
      // Storage unavailable: hide for this visit only.
    }
    setShow(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[color:var(--color-hairline)] bg-background/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          We use cookies and browser storage only to keep you signed in and remember your settings.
          We don't use advertising or analytics trackers.{" "}
          <Link
            to="/privacy"
            hash="storage"
            className="text-foreground underline underline-offset-4"
          >
            Learn more
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-sm border border-foreground px-5 py-2 text-[12px] font-medium uppercase tracking-[0.15em] transition-colors active:bg-foreground active:text-background [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
