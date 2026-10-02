import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SCORE_INFO, type ScoreInfoEntry, type ScoreKey } from "@/lib/ratings/score-info";

/**
 * Wraps a score so hovering it (mouse), tapping it (touch) or focusing it and
 * pressing Enter/Space (keyboard) shows a short card explaining what the
 * score means. The trigger is a span, not a button, so it can sit inside
 * clickable rows; its clicks don't reach the row.
 *
 * Pass `info` for a glossary entry (lib/ratings/score-info.ts), and/or
 * `children`/`body` for a custom card (e.g. the overall rating, which adds the
 * employer's own numbers).
 */
export function ScoreInfo({
  info,
  body,
  value,
  children,
  label,
  underline = true,
}: {
  info?: ScoreKey;
  /** Extra card content, shown above the glossary text. */
  body?: ReactNode;
  /** The employer's own value, e.g. "72/100" or "#12 of ~1,000". */
  value?: ReactNode;
  children: ReactNode;
  /** Accessible name for the trigger; defaults to the glossary title. */
  label?: string;
  underline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // How the last press started: a mouse click on an already-hovered score
  // should keep the card open, a tap should toggle it.
  const pressedWith = useRef<string>("");
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const entry: ScoreInfoEntry | null = info ? SCORE_INFO[info] : null;

  const hoverOpen = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label={`What does ${label ?? entry?.title ?? "this score"} mean?`}
          onPointerEnter={hoverOpen}
          onPointerLeave={hoverClose}
          onPointerDown={(e) => {
            pressedWith.current = e.pointerType;
            // Radix opens/closes on pointerdown; this component decides on click.
            e.preventDefault();
          }}
          onClick={(e) => {
            // Don't expand the row/card this score sits in.
            e.stopPropagation();
            e.preventDefault();
            if (pressedWith.current === "mouse") setOpen(true);
            else setOpen((o) => !o);
            pressedWith.current = "";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setOpen((o) => !o);
            }
          }}
          className={`inline-flex cursor-help items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 ${
            underline
              ? "underline decoration-dotted decoration-muted-foreground/60 underline-offset-[3px]"
              : ""
          }`}
        >
          {children}
        </span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onPointerEnter={hoverOpen}
          onPointerLeave={hoverClose}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
          className="z-50 max-h-[min(70vh,var(--radix-popover-content-available-height))] w-[min(20rem,calc(100vw-24px))] overflow-y-auto rounded-sm border border-[color:var(--color-hairline)] bg-background p-4 text-left text-xs leading-relaxed text-foreground shadow-lg normal-case tracking-normal"
        >
          {entry && (
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">{entry.title}</p>
              {value !== undefined && <p className="shrink-0 text-sm tabular-nums">{value}</p>}
            </div>
          )}
          {body && <div className={entry ? "mt-2" : ""}>{body}</div>}
          {entry && (
            <>
              <p className="mt-2 text-muted-foreground">{entry.what}</p>
              {entry.scale && <p className="mt-2 text-muted-foreground">{entry.scale}</p>}
              {entry.source && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Source:{" "}
                  <a
                    href={entry.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    {entry.source.name}
                  </a>
                </p>
              )}
            </>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
