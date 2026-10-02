import { Eye, EyeOff } from "lucide-react";
import { useRef, useState } from "react";

/**
 * A password field with an eye button that shows or hides what's typed.
 * Used by every password field (sign-in, sign-up, coach sign-up, reset and
 * change password) through the Field components and on its own.
 */
export function PasswordInput({
  value,
  onChange,
  autoComplete,
  required,
  className = "",
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  /** Classes for the input itself; room for the eye is added on the right. */
  className?: string;
  id?: string;
}) {
  const [shown, setShown] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function toggle() {
    setShown((s) => !s);
    // Keep the cursor where it was so people can carry on typing.
    const el = input.current;
    if (!el) return;
    const at = el.selectionStart;
    requestAnimationFrame(() => {
      el.focus();
      if (at !== null) el.setSelectionRange(at, at);
    });
  }

  return (
    <span className="relative block">
      <input
        ref={input}
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        // Some browsers offer to capitalise or correct a visible password.
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        title={shown ? "Hide password" : "Show password"}
        className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 [@media(hover:hover)]:hover:text-foreground"
      >
        {shown ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </span>
  );
}
