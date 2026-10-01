import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";
import { mutedButton, outlineButton } from "./ui";

const WHAT_GOES = [
  "Your account, sign-in and profile",
  "Your résumé files and résumé text",
  "Job preferences, bookmarks and applications",
  "Saved answers and autofill history",
  "Messages, notifications and career-service requests",
  "Recruiter invitations, saved candidates and jobs you posted",
];

/**
 * Settings → Delete account: permanent, immediate, self-service deletion
 * (src/lib/account.server.ts). Typing DELETE guards against slips.
 */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  async function remove() {
    setDeleting(true);
    try {
      await deleteMyAccount({ data: { confirm: "DELETE" } });
    } catch (e) {
      setDeleting(false);
      return toast.error(e instanceof Error ? e.message : "Couldn't delete your account");
    }
    // The session's user no longer exists; clear it from this browser too.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    toast.success("Your account and data have been deleted.");
    navigate({ to: "/" });
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold">Delete account</h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Permanently delete your Savant account and everything in it. This happens immediately and
        can't be undone.{" "}
        <Link to="/privacy" hash="retention" className="underline underline-offset-4">
          What we keep and why
        </Link>
      </p>
      <button
        type="button"
        onClick={() => (setTyped(""), setOpen(true))}
        className={`mt-6 ${outlineButton} border-red-700 text-red-700 [@media(hover:hover)]:hover:bg-red-700 [@media(hover:hover)]:hover:text-white dark:border-red-400 dark:text-red-400`}
      >
        Delete my account
      </button>

      <Dialog open={open} onOpenChange={(o) => !deleting && setOpen(o)}>
        <DialogContent className="max-w-md rounded-sm">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold tracking-normal">
              Delete your account?
            </DialogTitle>
            <DialogDescription>This permanently deletes:</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {WHAT_GOES.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Applications you already sent to employers on their own sites stay with them. If you use
            Savant Apply, remove it from your browser too.
          </p>
          <label className="block text-sm">
            Type <strong>DELETE</strong> to confirm
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="mt-2 w-full rounded-sm border border-[color:var(--color-hairline)] bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground"
            />
          </label>
          <div className="flex items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={deleting}
              className={mutedButton}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={typed !== "DELETE" || deleting}
              className="rounded-sm bg-red-700 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white disabled:opacity-40"
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
