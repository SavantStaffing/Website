import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { label } from "./ui";

export type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "unchanged";

/** Usernames are a unique handle (2–40 characters); real names live in full_name. */
export const USERNAME_RE = /^[A-Za-z0-9._-]{2,40}$/;

/** Whether a form may save with this status ("checking" waits). */
export const usernameOk = (s: UsernameStatus) => s === "available" || s === "unchanged";

/**
 * A username input that checks availability as you type (ignoring case,
 * like the database) and offers free alternatives when it's taken.
 * `current` is the user's own username, which is always fine to keep.
 */
export function UsernameField({
  value,
  onChange,
  onStatus,
  current,
}: {
  value: string;
  onChange: (v: string) => void;
  onStatus?: (s: UsernameStatus) => void;
  current?: string | null;
}) {
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const name = value.trim();
    let next: UsernameStatus | null = null;
    if (!name) next = "idle";
    else if (current && name.toLowerCase() === current.toLowerCase()) next = "unchanged";
    else if (!USERNAME_RE.test(name)) next = "invalid";
    if (next) {
      setStatus(next);
      setSuggestions([]);
      onStatus?.(next);
      return;
    }
    setStatus("checking");
    onStatus?.("checking");
    let live = true;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("username_available", { _name: name });
      if (!live) return;
      // If the check itself fails, let the save go ahead: the database still
      // guarantees uniqueness and the form shows a clear message if it clashes.
      const r = (data ?? {}) as { available?: boolean; suggestions?: string[] };
      const s: UsernameStatus = error || r.available ? "available" : "taken";
      setStatus(s);
      setSuggestions(r.suggestions ?? []);
      onStatus?.(s);
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // onStatus is a setter from the parent; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, current]);

  return (
    <div>
      <label className="block">
        <span className={label}>Username</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s+/g, ""))}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={40}
          aria-invalid={status === "taken" || status === "invalid"}
          aria-describedby="username-status"
          className="mt-2 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-3 text-base outline-none focus:border-foreground"
        />
      </label>
      <p id="username-status" className="mt-1 text-xs text-muted-foreground" aria-live="polite">
        {status === "checking" && "Checking…"}
        {status === "available" && "✓ Available"}
        {status === "unchanged" && "Your current username"}
        {status === "invalid" &&
          "2–40 characters: letters, numbers, dots, dashes or underscores. No spaces."}
        {status === "idle" && "A unique handle. Your real name goes in Full name."}
        {status === "taken" && (
          <>
            That username is taken.
            {suggestions.length > 0 && " Try "}
            {suggestions.map((s, i) => (
              <span key={s}>
                {i > 0 && (i === suggestions.length - 1 ? " or " : ", ")}
                <button
                  type="button"
                  onClick={() => onChange(s)}
                  className="text-foreground underline underline-offset-4"
                >
                  {s}
                </button>
              </span>
            ))}
          </>
        )}
      </p>
    </div>
  );
}

/** A friendly message for a failed profile save. */
export function profileSaveError(e: { code?: string; message: string }): string {
  return e.code === "23505" && /username/i.test(e.message)
    ? "That username was just taken by someone else. Pick another one."
    : e.message;
}
