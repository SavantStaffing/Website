import {
  DAY_LABEL,
  DAYS,
  PRESETS,
  TIMES,
  summarizeAvailability,
  timeLabel,
  type Availability,
  type Day,
} from "@/lib/talent/intake";
import { mutedButton } from "@/components/site/ui";

/** Weekly availability: each day on/off with a start and end time. */
export function AvailabilityEditor({
  value,
  onChange,
}: {
  value: Availability;
  onChange: (next: Availability) => void;
}) {
  const set = (day: Day, slot: Availability[Day]) => onChange({ ...value, [day]: slot });

  function applyPreset(days: Day[], start: string, end: string) {
    const next = { ...value };
    for (const d of days) next[d] = { start, end };
    onChange(next);
  }

  function copyMondayToWeekdays() {
    const mon = value.mon;
    if (!mon) return;
    onChange({ ...value, tue: { ...mon }, wed: { ...mon }, thu: { ...mon }, fri: { ...mon } });
  }

  const selectCls =
    "rounded-sm border border-[color:var(--color-hairline)] bg-transparent px-2 py-1.5 text-sm disabled:opacity-40";

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.days, p.start, p.end)}
            className="rounded-full border border-[color:var(--color-hairline)] px-3 py-1 text-xs [@media(hover:hover)]:hover:border-foreground"
          >
            + {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(Object.fromEntries(DAYS.map((d) => [d, null])) as Availability)}
          className="rounded-full px-3 py-1 text-xs text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
        >
          Clear all
        </button>
      </div>

      <ul className="mt-4 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
        {DAYS.map((d) => {
          const slot = value[d];
          const on = !!slot;
          return (
            <li key={d} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <label className="flex w-36 cursor-pointer items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`Available on ${DAY_LABEL[d]}`}
                  onClick={() => set(d, on ? null : { start: "09:00", end: "17:00" })}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-foreground" : "bg-[color:var(--color-hairline)]"}`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`}
                  />
                </button>
                <span className={`text-sm ${on ? "" : "text-muted-foreground"}`}>
                  {DAY_LABEL[d]}
                </span>
              </label>
              {on ? (
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`${DAY_LABEL[d]} start time`}
                    value={slot.start}
                    onChange={(e) => {
                      const start = e.target.value;
                      set(d, {
                        start,
                        end:
                          slot.end > start ? slot.end : (TIMES[TIMES.indexOf(start) + 1] ?? start),
                      });
                    }}
                    className={selectCls}
                  >
                    {TIMES.slice(0, -1).map((t) => (
                      <option key={t} value={t}>
                        {timeLabel(t)}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-muted-foreground">to</span>
                  <select
                    aria-label={`${DAY_LABEL[d]} end time`}
                    value={slot.end}
                    onChange={(e) => set(d, { start: slot.start, end: e.target.value })}
                    className={selectCls}
                  >
                    {TIMES.filter((t) => t > slot.start).map((t) => (
                      <option key={t} value={t}>
                        {timeLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Unavailable</span>
              )}
              {d === "mon" && on && (
                <button
                  type="button"
                  onClick={copyMondayToWeekdays}
                  className={`ml-auto ${mutedButton}`}
                >
                  Copy to weekdays
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Summary: {summarizeAvailability(value)}</p>
    </div>
  );
}
