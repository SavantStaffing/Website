import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Page numbers to show: always the first and last page and the pages around
 * the current one, with "…" for the gaps, e.g. 1 … 4 5 6 … 20.
 */
function pageItems(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  const items: (number | "gap")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (keep.has(p)) items.push(p);
    else if (items[items.length - 1] !== "gap") items.push("gap");
  }
  return items;
}

/** Numbered pager: ‹ 1 … 4 5 6 … 20 › plus "41–60 of 389". Pages are 1-based. */
export function PageBar({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const step =
    "inline-flex h-9 min-w-9 items-center justify-center px-2 text-sm tabular-nums disabled:opacity-30 [@media(hover:hover)]:enabled:hover:bg-[color:var(--color-hairline)]";

  return (
    <nav
      aria-label="Pages"
      className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--color-hairline)] pt-6"
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground tabular-nums">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <button
          className={step}
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageItems(page, pages).map((p, i) =>
          p === "gap" ? (
            <span key={`gap${i}`} className="px-1 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              className={`${step} ${p === page ? "bg-foreground text-background [@media(hover:hover)]:enabled:hover:bg-foreground" : ""}`}
              onClick={() => onPage(p)}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button
          className={step}
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
