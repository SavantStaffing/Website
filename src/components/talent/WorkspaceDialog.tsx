import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mutedButton, outlineButton } from "@/components/site/ui";

export function WorkspaceDialog({
  open,
  onOpenChange,
  note,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">Build your workspace in Notion</DialogTitle>
          <DialogDescription>
            Your coach recommends creating an organized workspace to showcase your skills.
            Continue to Notion to sign in or create an account and start a page for your portfolio,
            projects, and job search.
          </DialogDescription>
        </DialogHeader>
        {note && <p className="whitespace-pre-wrap text-sm"><span className="font-medium">Coach’s note: </span>{note}</p>}
        <p className="text-sm text-muted-foreground">
          Your task is saved in Savant. Opening Notion does not mark it complete.
          You can reopen this prompt from your Coach or Tasks page.
        </p>
        <DialogFooter className="gap-3">
          <DialogClose asChild><button type="button" className={mutedButton}>Maybe later</button></DialogClose>
          <a href="https://www.notion.so/" target="_blank" rel="noopener noreferrer"
            className={outlineButton} onClick={() => onOpenChange(false)}>
            Continue to Notion ↗
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
