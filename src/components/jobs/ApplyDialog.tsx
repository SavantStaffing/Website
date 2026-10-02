import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { card, label, mutedButton, primaryButton } from "@/components/site/ui";
import { getAutofillReadiness } from "@/lib/autofill/autofill.functions";
import {
  AUTOFILL_ATS_LABEL,
  SAVANT_APPLY_DOWNLOAD,
  autofillAtsFor,
  getAlwaysAutofill,
  setAlwaysAutofill,
  type ExtensionStatus,
} from "@/lib/autofill/extension";

export type ApplyTarget = { title: string; company: string; applyUrl: string };

type Readiness = Awaited<ReturnType<typeof getAutofillReadiness>>;

/**
 * Shown when a talent clicks Apply on a job whose application form Savant
 * Apply can fill (Greenhouse, Lever, Ashby, Workday). Offers autofill at the moment
 * it's useful, walks them through installing the extension if they don't
 * have it, and always leaves a plain "apply without autofill" path.
 */
export function ApplyDialog({
  target,
  status,
  onRecheck,
  onClose,
  onContinue,
}: {
  target: ApplyTarget | null;
  status: ExtensionStatus;
  onRecheck: () => void;
  onClose: () => void;
  onContinue: (autofill: boolean) => void;
}) {
  const [always, setAlways] = useState(false);
  const [readiness, setReadiness] = useState<Readiness | "loading" | null>(null);
  const ats = target ? autofillAtsFor(target.applyUrl) : null;
  const installed = status.state === "installed";

  useEffect(() => {
    if (!target) return;
    setAlways(getAlwaysAutofill());
    setReadiness(null);
    // Only Greenhouse forms can be read ahead of time.
    if (autofillAtsFor(target.applyUrl) !== "greenhouse") return;
    let live = true;
    setReadiness("loading");
    getAutofillReadiness({ data: { jobUrl: target.applyUrl } })
      .then((r) => live && setReadiness(r))
      .catch(() => live && setReadiness(null));
    return () => {
      live = false;
    };
  }, [target]);

  function go(autofill: boolean) {
    if (autofill) setAlwaysAutofill(always);
    onContinue(autofill);
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-sm">
        {target && (
          <>
            <DialogHeader className="text-left">
              <p className={label}>Apply</p>
              <DialogTitle className="text-2xl font-semibold leading-tight tracking-normal">
                {target.title}
              </DialogTitle>
              <DialogDescription>
                {target.company} takes applications on{" "}
                {ats ? AUTOFILL_ATS_LABEL[ats] : "its own site"}. We'll open it in a new tab.
              </DialogDescription>
            </DialogHeader>

            <div className={card}>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-lg font-medium">Autofill this application</h3>
                {installed && (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                    Savant Apply on
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Savant Apply fills in your name, contact details, résumé and the answers you've
                saved. Fields that need your attention are outlined, and{" "}
                <strong className="font-medium text-foreground">
                  you review everything and press submit yourself
                </strong>
                . Savant never submits for you.
              </p>
              {ats === "workday" && (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Workday asks you to sign in or create an account with {target.company} first. Once
                  you're in, Savant Apply fills each step of the form as you go.
                </p>
              )}

              {readiness === "loading" && (
                <p className="mt-4 text-xs text-muted-foreground">Reading the application form…</p>
              )}
              {readiness && readiness !== "loading" && readiness.supported && (
                <div className="mt-4 text-sm">
                  Your profile can answer <strong>{readiness.answerable}</strong> of{" "}
                  <strong>{readiness.required}</strong> required questions.
                  {readiness.missing.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      You'll answer: {readiness.missing.slice(0, 5).join(" · ")}
                      {readiness.missing.length > 5 && " …"}.{" "}
                      <Link to="/talent/profile" className="underline underline-offset-4">
                        Complete your profile
                      </Link>
                    </p>
                  )}
                </div>
              )}

              {status.state === "checking" && (
                <p className="mt-5 text-xs text-muted-foreground">Checking for Savant Apply…</p>
              )}

              {installed && (
                <div className="mt-5 space-y-4">
                  {!status.connected && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Savant Apply isn't linked to your account yet. Reload this page while you're
                      signed in, then try again.
                    </p>
                  )}
                  <label className="flex cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={always}
                      onChange={(e) => setAlways(e.target.checked)}
                      className="h-4 w-4 accent-foreground"
                    />
                    Always autofill when available (skip this step)
                  </label>
                  <button
                    type="button"
                    onClick={() => go(true)}
                    className={`w-full ${primaryButton}`}
                  >
                    Autofill &amp; continue ↗
                  </button>
                </div>
              )}

              {status.state === "missing" && (
                <div className="mt-5">
                  <p className="text-sm font-medium">Install Savant Apply — about 2 minutes</p>
                  <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                    <li>
                      <a
                        href={SAVANT_APPLY_DOWNLOAD}
                        download
                        className="text-foreground underline underline-offset-4"
                      >
                        Download Savant Apply
                      </a>{" "}
                      and unzip it.
                    </li>
                    <li>
                      Open <code className="text-foreground">chrome://extensions</code> and turn on{" "}
                      <em>Developer mode</em>.
                    </li>
                    <li>
                      Click <em>Load unpacked</em> and choose the <em>savant-apply</em> folder.
                    </li>
                    <li>Reload this page.</li>
                  </ol>
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <Link to="/autofill" target="_blank" className={mutedButton}>
                      Full install guide ↗
                    </Link>
                    <button type="button" onClick={onRecheck} className={mutedButton}>
                      I've installed it — check again
                    </button>
                  </div>
                </div>
              )}

              {status.state === "unsupported" && (
                <p className="mt-5 text-sm text-muted-foreground">
                  Autofill works in Chrome or Edge on a computer. On this device, apply the usual
                  way — your Savant profile stays ready for next time.{" "}
                  <Link to="/autofill" target="_blank" className="underline underline-offset-4">
                    Learn more
                  </Link>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <button type="button" onClick={() => go(false)} className={mutedButton}>
                Apply without autofill ↗
              </button>
              <span className="text-xs text-muted-foreground">
                We'll add it to your applications either way.
              </span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
