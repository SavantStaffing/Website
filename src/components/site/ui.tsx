import { useState, type ReactNode } from "react";

/**
 * Small shared building blocks in the site's existing style (hairline
 * borders, uppercase micro-labels). Pages used to redefine `Field` locally;
 * new pages use these instead.
 */

export const label = "text-[11px] uppercase tracking-[0.25em] text-muted-foreground";
export const linkButton =
  "text-[11px] uppercase tracking-[0.2em] [@media(hover:hover)]:hover:text-muted-foreground disabled:opacity-50";
export const mutedButton =
  "text-[11px] uppercase tracking-[0.2em] text-muted-foreground [@media(hover:hover)]:hover:text-foreground disabled:opacity-50";
export const primaryButton =
  "rounded-sm bg-foreground px-6 py-3 text-[12px] font-medium uppercase tracking-[0.2em] text-background disabled:opacity-50";
export const outlineButton =
  "rounded-sm border border-foreground px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] transition-colors [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background disabled:opacity-50";
export const card = "rounded-sm border border-[color:var(--color-hairline)] p-6";
export const list =
  "divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]";
export const selectCls =
  "rounded-sm border border-[color:var(--color-hairline)] bg-transparent px-3 py-2 text-[12px] uppercase tracking-[0.15em] disabled:opacity-50";

export function Field({
  label: text,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className={label}>{text}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-3 text-base outline-none focus:border-foreground"
      />
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function TextArea({
  label: text,
  value,
  onChange,
  rows = 5,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={label}>{text}</span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 block w-full rounded-sm border border-[color:var(--color-hairline)] bg-transparent p-3 text-sm outline-none focus:border-foreground"
      />
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label: text,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-4 py-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-foreground"
      />
      <span>
        <span className="block text-sm">{text}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        )}
      </span>
    </label>
  );
}

/** Multi-choice as toggleable chips (employment types, sources, …). */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={`rounded-sm border px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] transition-colors ${
              on
                ? "border-foreground bg-foreground text-background"
                : "border-[color:var(--color-hairline)] text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Free-text list entry ("Warehouse associate", "Forklift operator"…) as removable tags. */
export function TagInput({
  label: text,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  function commit() {
    const parts = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])]);
    setDraft("");
  }
  return (
    <div>
      <span className={label}>{text}</span>
      <div className="mt-2 flex flex-wrap items-center gap-2 border-b border-[color:var(--color-hairline)] py-2 focus-within:border-foreground">
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-2 rounded-sm bg-muted px-2 py-1 text-xs"
          >
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(value.filter((x) => x !== v))}
              className="text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          className="min-w-[10ch] flex-1 bg-transparent py-1 text-base outline-none"
        />
      </div>
    </div>
  );
}

export function Stat({
  label: text,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={card}>
      <div className={label}>{text}</div>
      <div className="mt-3 text-4xl font-semibold">{value ?? "…"}</div>
      {children}
    </div>
  );
}

export function SectionHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-6 text-sm text-muted-foreground">{children}</p>;
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "good" | "warn" | "bad";
}) {
  const tones = {
    muted: "border-[color:var(--color-hairline)] text-muted-foreground",
    good: "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
    warn: "border-amber-600/40 text-amber-700 dark:text-amber-400",
    bad: "border-red-600/40 text-red-700 dark:text-red-400",
  };
  return (
    <span
      className={`inline-block rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  if (d < 60) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
