import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { label, mutedButton, primaryButton } from "@/components/site/ui";

export type ShareTarget = { id: string; title: string; company: string };

type Recipient = {
  talent_id: string;
  display_name: string;
  detail: string | null;
  already_shared: boolean;
};

/**
 * Coaches and admins send a job to talent. The list comes from
 * share_job_recipients(): every talent for an admin, a coach's assigned
 * talent for a coach. share_job() checks each recipient again and notifies them.
 */
export function ShareJobDialog({ job, onClose }: { job: ShareTarget | null; onClose: () => void }) {
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!job) return;
    setRecipients(null);
    setError(null);
    setQuery("");
    setPicked(new Set());
    setNote("");
    let live = true;
    supabase.rpc("share_job_recipients", { _job_id: job.id }).then(({ data, error }) => {
      if (!live) return;
      if (error) setError(error.message);
      else setRecipients((data as Recipient[]) ?? []);
    });
    return () => {
      live = false;
    };
  }, [job]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (recipients ?? []).filter(
      (r) => !q || r.display_name.toLowerCase().includes(q) || r.detail?.toLowerCase().includes(q),
    );
  }, [recipients, query]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    if (!job || !picked.size) return;
    setSending(true);
    const { data, error } = await supabase.rpc("share_job", {
      _job_id: job.id,
      _talent_ids: [...picked],
      _note: note.trim() || null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    const n = Number(data ?? picked.size);
    toast.success(`Sent to ${n} ${n === 1 ? "person" : "people"}.`);
    onClose();
  }

  return (
    <Dialog open={!!job} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-sm">
        {job && (
          <>
            <DialogHeader className="text-left">
              <p className={label}>Send to talent</p>
              <DialogTitle className="text-2xl font-semibold leading-tight tracking-normal">
                {job.title}
              </DialogTitle>
              <DialogDescription>
                {job.company}. They'll see it on their dashboard and get a notification.
              </DialogDescription>
            </DialogHeader>

            {error ? (
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            ) : !recipients ? (
              <p className="text-sm text-muted-foreground">Loading talent…</p>
            ) : recipients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No talent to send to yet. Talent assigned to you will appear here.
              </p>
            ) : (
              <div className="space-y-5">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${recipients.length} talent`}
                  aria-label="Search talent"
                  className="block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-2 text-sm outline-none focus:border-foreground"
                />
                <ul className="max-h-72 divide-y divide-[color:var(--color-hairline)] overflow-y-auto border-y border-[color:var(--color-hairline)]">
                  {shown.map((r) => (
                    <li key={r.talent_id}>
                      <label className="flex cursor-pointer items-center gap-3 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={picked.has(r.talent_id)}
                          onChange={() => toggle(r.talent_id)}
                          className="h-4 w-4 accent-foreground"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{r.display_name}</span>
                          {r.detail && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {r.detail}
                            </span>
                          )}
                        </span>
                        {r.already_shared && (
                          <span className="shrink-0 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                            Already sent
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                  {shown.length === 0 && (
                    <li className="py-3 text-sm text-muted-foreground">No one matches.</li>
                  )}
                </ul>
                <label className="block">
                  <span className={label}>Note (optional)</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 500))}
                    rows={3}
                    placeholder="Why this role is a good fit"
                    className="mt-2 block w-full resize-y rounded-sm border border-[color:var(--color-hairline)] bg-transparent p-3 text-sm outline-none focus:border-foreground"
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <button onClick={onClose} className={mutedButton}>
                    Cancel
                  </button>
                  <button
                    onClick={send}
                    disabled={sending || picked.size === 0}
                    className={primaryButton}
                  >
                    {sending
                      ? "Sending…"
                      : picked.size
                        ? `Send to ${picked.size} ${picked.size === 1 ? "person" : "people"}`
                        : "Pick who to send to"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
