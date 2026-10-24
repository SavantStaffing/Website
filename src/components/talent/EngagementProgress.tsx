import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { label } from "@/components/site/ui";
import { ENGAGEMENT_SERVICES, stepId } from "@/lib/talent/engagement";

/**
 * Completion marker. Complete: a small blue dot with a soft glow. Incomplete:
 * a hollow black circle, slightly larger. Both sit in the same box so rows
 * line up whichever one they show.
 */
function StatusDot({ done }: { done: boolean }) {
  return (
    <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center" aria-hidden="true">
      {done ? (
        <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_6px_1px_rgba(59,130,246,0.65)]" />
      ) : (
        <span className="h-3 w-3 rounded-full border border-foreground" />
      )}
    </span>
  );
}

/**
 * One talent's progress through each Savant service: a row per service with
 * its overall status, and click a service to see its steps. Coaches assigned
 * to the talent and admins can tick steps off (canEdit); the talent's résumé
 * upload and finished intake count automatically.
 */
export function EngagementProgress({
  talentId,
  canEdit,
  bare = false,
}: {
  talentId: string;
  canEdit: boolean;
  /** Omit the "Engagement" label and top margin (the page has its own heading). */
  bare?: boolean;
}) {
  const [done, setDone] = useState<Set<string> | null>(null);
  const [auto, setAuto] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [steps, autoRes] = await Promise.all([
        supabase.from("engagement_steps").select("service, step").eq("talent_id", talentId),
        supabase.rpc("engagement_auto", { _talent: talentId }),
      ]);
      if (cancelled) return;
      if (steps.error) toast.error(steps.error.message);
      setDone(new Set((steps.data ?? []).map((s) => stepId(s.service, s.step))));
      const derived = new Set<string>();
      const flags = autoRes.data?.[0];
      if (flags?.resume_uploaded) derived.add(stepId("resume", "upload"));
      if (flags?.intake_done) derived.add(stepId("scout", "preferences"));
      setAuto(derived);
    })();
    return () => {
      cancelled = true;
    };
  }, [talentId]);

  const isDone = (id: string) => auto.has(id) || !!done?.has(id);

  async function toggle(service: string, step: string) {
    const id = stepId(service, step);
    if (!canEdit || auto.has(id) || busy) return;
    const wasDone = !!done?.has(id);
    setBusy(id);
    const next = new Set(done);
    if (wasDone) next.delete(id);
    else next.add(id);
    setDone(next);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = wasDone
      ? await supabase
          .from("engagement_steps")
          .delete()
          .eq("talent_id", talentId)
          .eq("service", service)
          .eq("step", step)
      : await supabase
          .from("engagement_steps")
          .insert({ talent_id: talentId, service, step, completed_by: auth.user?.id });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      setDone(done); // roll back
    }
  }

  return (
    <div className={bare ? "max-w-xl" : "mt-6 max-w-xl"}>
      {!bare && <div className={label}>Engagement</div>}
      {!done ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="mt-3 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
          {ENGAGEMENT_SERVICES.map((svc) => {
            const complete = svc.steps.filter((s) => isDone(stepId(svc.key, s.key))).length;
            const all = complete === svc.steps.length;
            const expanded = open === `${talentId}:${svc.key}`;
            return (
              <li key={svc.key}>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : `${talentId}:${svc.key}`)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-3 py-3 text-left text-sm"
                >
                  <StatusDot done={all} />
                  <span className="flex-1 font-medium">{svc.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {complete}/{svc.steps.length}
                  </span>
                  <span className="sr-only">{all ? "Complete" : "Incomplete"}</span>
                </button>
                {expanded && (
                  <ul className="pb-3 pl-6">
                    {svc.steps.map((s) => {
                      const id = stepId(svc.key, s.key);
                      const complete = isDone(id);
                      const locked = !canEdit || auto.has(id);
                      return (
                        <li key={s.key}>
                          <button
                            type="button"
                            onClick={() => toggle(svc.key, s.key)}
                            disabled={locked || busy === id}
                            aria-pressed={complete}
                            className="flex w-full items-center gap-3 py-2 text-left text-sm disabled:cursor-default"
                          >
                            <StatusDot done={complete} />
                            <span className={complete ? "" : "text-muted-foreground"}>
                              {s.label}
                            </span>
                            {auto.has(id) && (
                              <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                                automatic
                              </span>
                            )}
                            <span className="sr-only">{complete ? "Complete" : "Incomplete"}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
