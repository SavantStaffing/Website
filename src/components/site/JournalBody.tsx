import type { Block, Inline } from "@/lib/journal/types";

const linkCls =
  "underline decoration-[color:var(--color-hairline)] underline-offset-4 [@media(hover:hover)]:hover:decoration-foreground";

function Inlines({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <span key={i}>{p}</span>
        ) : "bold" in p ? (
          <strong key={i} className="font-semibold text-foreground">
            {p.bold}
          </strong>
        ) : (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
            {p.text}
          </a>
        ),
      )}
    </>
  );
}

export function JournalBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-6 text-base leading-relaxed text-muted-foreground">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2":
            return (
              <h2 key={i} className="!mt-14 text-2xl font-semibold leading-snug text-foreground">
                {b.text}
              </h2>
            );
          case "p":
            return (
              <p key={i}>
                <Inlines parts={b.content} />
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-3 pl-5 marker:text-muted-foreground">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inlines parts={it} />
                  </li>
                ))}
              </ul>
            );
          case "table":
            return (
              <div key={i} className="-mx-6 overflow-x-auto px-6 lg:mx-0 lg:px-0">
                <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--color-hairline)]">
                      {b.head.map((h) => (
                        <th
                          key={h}
                          className="py-3 pr-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r} className="border-b border-[color:var(--color-hairline)] align-top">
                        {row.map((cell, c) => (
                          <td key={c} className="py-3 pr-4 text-foreground">
                            <Inlines parts={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
