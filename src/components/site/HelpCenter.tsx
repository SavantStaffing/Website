import { Link, type LinkProps } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { askHelp } from "@/lib/help/help.functions";
import {
  CONTACT_EMAIL,
  FAQ,
  PAGES,
  ROLE_LABEL,
  type Faq,
  type HelpRole,
} from "@/lib/help/knowledge";
import { label, linkButton, mutedButton, primaryButton } from "./ui";

type Turn = { role: "user" | "assistant"; content: string };

/** Paths the assistant may link to: the role's pages plus a few public ones. */
function knownPaths(role: HelpRole) {
  const paths = new Set(PAGES[role].map((p) => p.to));
  for (const f of FAQ[role]) for (const l of f.links ?? []) paths.add(l.to);
  [
    "/contact",
    "/faq",
    "/privacy",
    "/terms",
    "/employer-ratings",
    "/jobs",
    "/autofill",
    "/preparation",
  ].forEach((p) => paths.add(p));
  return paths;
}

/** Turns "(/talent/jobs)" in an answer into a link when it's a real page. */
function withLinks(text: string, paths: Set<string>): ReactNode[] {
  // **bold** first, then page paths inside each piece.
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((chunk, j) =>
    /^\*\*[^*\n]+\*\*$/.test(chunk) ? (
      <strong key={j} className="font-medium">
        {linkPaths(chunk.slice(2, -2), paths)}
      </strong>
    ) : (
      <span key={j}>{linkPaths(chunk.replace(/^#{1,4} /gm, ""), paths)}</span>
    ),
  );
}

function linkPaths(text: string, paths: Set<string>): ReactNode[] {
  const parts = text.split(/(\/[a-z0-9][a-z0-9/#-]*)/gi);
  return parts.map((part, i) => {
    const [path, hash] = part.split("#");
    if (paths.has(part) || paths.has(path)) {
      return (
        <Link
          key={i}
          to={path as LinkProps["to"]}
          hash={hash || undefined}
          className="underline underline-offset-4"
        >
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function FaqList({ items, open: openAll = false }: { items: Faq[]; open?: boolean }) {
  return (
    <div className="divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
      {items.map((f) => (
        <details key={f.q} open={openAll} className="group py-4">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-medium">
            {f.q}
            <span
              aria-hidden="true"
              className="text-muted-foreground transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {f.a}
          </p>
          {f.links && f.links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {f.links.map((l) => {
                const [path, hash] = l.to.split("#");
                return (
                  <Link
                    key={l.label}
                    to={path as LinkProps["to"]}
                    hash={hash || undefined}
                    className={linkButton}
                  >
                    {l.label} →
                  </Link>
                );
              })}
            </div>
          )}
        </details>
      ))}
    </div>
  );
}

/** A hub's Help page: the assistant, then this role's FAQ. */
export function HelpCenter({ role, guide }: { role: HelpRole; guide?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [filter, setFilter] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const paths = useMemo(() => knownPaths(role), [role]);
  const faq = FAQ[role];
  const shown = filter.trim()
    ? faq.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(filter.trim().toLowerCase()))
    : faq;

  async function ask(q: string) {
    const text = q.trim();
    if (!text || asking) return;
    const history = turns;
    setTurns([...history, { role: "user", content: text }]);
    setQuestion("");
    setAsking(true);
    try {
      const res = await askHelp({ data: { question: text, history } });
      setTurns((t) => [...t, { role: "assistant", content: res.answer }]);
    } catch {
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content: `Something went wrong. Try again, or email ${CONTACT_EMAIL}.`,
        },
      ]);
    } finally {
      setAsking(false);
      setTimeout(() => bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 50);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  return (
    <section className="max-w-3xl">
      <p className={label}>{ROLE_LABEL[role]}</p>
      <h1 className="mt-3 font-display text-3xl font-semibold md:text-4xl">Help</h1>
      <p className="mt-3 text-base text-muted-foreground">
        Ask the assistant, or browse the questions below.
        {guide && (
          <>
            {" "}
            New here? Start with{" "}
            <Link to={guide as LinkProps["to"]} className="underline underline-offset-4">
              Getting started
            </Link>
            .
          </>
        )}
      </p>

      {/* Assistant */}
      <div className="mt-8 border border-[color:var(--color-hairline)]">
        <div className="border-b border-[color:var(--color-hairline)] px-5 py-3">
          <div className="text-sm font-medium">Savant assistant</div>
          <p className="text-xs text-muted-foreground">
            Answers come from Savant's FAQ and guides. It can't see your account or make changes,
            and it can be wrong, so double-check anything important.
          </p>
        </div>
        <div className="max-h-[28rem] space-y-4 overflow-y-auto px-5 py-4" aria-live="polite">
          {turns.length === 0 ? (
            <div>
              <p className="text-sm text-muted-foreground">Try one of these:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {faq.slice(0, 4).map((f) => (
                  <button
                    key={f.q}
                    onClick={() => ask(f.q)}
                    className="rounded-sm border border-[color:var(--color-hairline)] px-3 py-1.5 text-left text-xs [@media(hover:hover)]:hover:border-foreground"
                  >
                    {f.q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((t, i) => (
              <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
                <div
                  className={
                    t.role === "user"
                      ? "max-w-[85%] rounded-sm bg-foreground px-3 py-2 text-sm text-background"
                      : "whitespace-pre-line text-sm leading-relaxed"
                  }
                >
                  {t.role === "assistant" ? withLinks(t.content, paths) : t.content}
                </div>
              </div>
            ))
          )}
          {asking && <p className="text-sm text-muted-foreground">Thinking…</p>}
          <div ref={bottom} />
        </div>
        <form
          onSubmit={submit}
          className="flex items-end gap-3 border-t border-[color:var(--color-hairline)] p-3"
        >
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void ask(question);
              }
            }}
            rows={2}
            maxLength={800}
            placeholder="Ask a question about Savant"
            aria-label="Your question"
            className="min-h-[2.75rem] flex-1 resize-none bg-transparent text-sm outline-none"
          />
          <button
            type="submit"
            disabled={asking || question.trim().length < 2}
            className={primaryButton}
          >
            Ask
          </button>
        </form>
        {turns.length > 0 && (
          <div className="border-t border-[color:var(--color-hairline)] px-5 py-2 text-right">
            <button onClick={() => setTurns([])} className={mutedButton}>
              Clear conversation
            </button>
          </div>
        )}
      </div>

      {/* FAQ */}
      <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-xl font-semibold">Frequently asked questions</h2>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search questions"
          aria-label="Search questions"
          className="w-56 border-b border-[color:var(--color-hairline)] bg-transparent py-1.5 text-sm outline-none focus:border-foreground"
        />
      </div>
      <div className="mt-4">
        {shown.length ? (
          <FaqList items={shown} />
        ) : (
          <p className="text-sm text-muted-foreground">No questions match.</p>
        )}
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        Still stuck? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>{" "}
        or use the{" "}
        <Link to="/contact" className="underline underline-offset-4">
          Contact page
        </Link>
        . The full FAQ for every account type is at{" "}
        <Link to="/faq" className="underline underline-offset-4">
          /faq
        </Link>
        .
      </p>
    </section>
  );
}
