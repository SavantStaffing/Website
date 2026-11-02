import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { card, label, mutedButton, primaryButton } from "@/components/site/ui";
import { useSavantCoach } from "@/lib/autofill/extension";

const DISMISSED_KEY = "savant-coach:prompt-dismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Tells a coach about the Savant Coach extension until it is installed and
 * connected, the way talent are prompted to install Savant Apply. Hidden on
 * browsers that can't run it, and once dismissed (per browser).
 */
export function CoachExtensionPrompt() {
  const { status } = useSavantCoach();
  const [dismissed, setDismissed] = useState(wasDismissed);
  if (dismissed) return null;
  if (status.state !== "missing" && !(status.state === "installed" && !status.connected))
    return null;

  const connecting = status.state === "installed";
  return (
    <div className={card}>
      <p className={label}>Savant Coach</p>
      <p className="mt-2 text-lg font-medium">
        {connecting
          ? "Savant Coach is installed. Reload this page to connect it."
          : "Check job listings before you recommend them"}
      </p>
      {!connecting && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Savant Coach's Browser Extension allows you to filter out ghost listings before you recommend a position.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        {!connecting && (
          <Link to="/coach/extension" className={primaryButton}>
            Install guide
          </Link>
        )}
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(DISMISSED_KEY, "1");
            } catch {
              // Storage blocked: the prompt just comes back next visit.
            }
            setDismissed(true);
          }}
          className={mutedButton}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
