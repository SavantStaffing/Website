/** Calendar items as standard iCalendar (.ics), for the feed and downloads. */

export type CalendarItem = {
  id: string;
  kind: string; // event | session | interview
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  notes: string | null;
  link: string | null;
};

const SITE = "https://savantalent.com";

const stamp = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

// RFC 5545: escape \ ; , and newlines; fold lines longer than 75 octets.
const esc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 75;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function toIcs(items: CalendarItem[], name = "Savant"): string {
  const now = stamp(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Savant Staffing//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of items) {
    const description = [e.notes, e.link ? `Details: ${SITE}${e.link}` : null]
      .filter(Boolean)
      .join("\n\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@savantalent.com`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(e.starts_at)}`,
      `DTEND:${stamp(e.ends_at)}`,
      `SUMMARY:${esc(e.title)}`,
      ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      ...(e.location?.startsWith("http") ? [`URL:${esc(e.location)}`] : []),
      ...(description ? [`DESCRIPTION:${esc(description)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** "Add to Google Calendar" link for one item. */
export function googleCalendarUrl(e: CalendarItem): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.starts_at)}/${stamp(e.ends_at)}`,
    details: [e.notes, e.link ? `${SITE}${e.link}` : null].filter(Boolean).join("\n\n"),
    location: e.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
