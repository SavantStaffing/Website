/**
 * Ghost-listing check for career coaches ("Savant Coach" extension).
 *
 * Pure decision logic, no network and no database, so it is unit-testable
 * (scripts/coach-ghost-test.ts). The server (listing.server.ts) gathers the
 * evidence, this file turns it into a PASS / NO PASS verdict.
 *
 * It builds on the scout's Ghost Job Detector (src/lib/scout/ghost.ts) and
 * adds the signals only a live look at the page can see: a "no longer
 * accepting applications" banner, an expired validThrough date, the hiring
 * board saying the posting is gone, reposts, and AI-spotted wording problems.
 *
 * Policy:
 *  - any BLOCK signal            → NO PASS
 *  - total score ≥ the scout's flag threshold (50) → NO PASS
 *  - otherwise                   → PASS
 * PASS means "no ghost signals found", not "guaranteed real": `confidence`
 * says how much evidence backed it.
 */
import { GHOST_FLAG_THRESHOLD, scoreGhost } from "../scout/ghost.ts";

export type LiveStatus = "open" | "closed" | "unknown";

export type Signal = {
  id: string;
  severity: "block" | "warn" | "info";
  text: string;
  /** Points added to the ghost score (omitted for block/info signals). */
  points?: number;
  /** A short quote from the posting that backs the signal. */
  evidence?: string;
};

export type ListingInput = {
  url: string;
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
  /** The description was actually read (false for a bare sheet row we could not fetch). */
  description_read: boolean;
  posted_at: string | null;
  valid_through: string | null;
  /** Text of a "no longer accepting applications" style banner found on the page. */
  closed_banner: string | null;
  /** An Apply button or link is on the page (null = not checked). */
  apply_control: boolean | null;
  /** The page's own wording, e.g. "Posted 45 days ago". */
  posted_text: string | null;
  reposted: boolean;
};

/** What Savant already knows about this exact posting from the scout. */
export type KnownPosting = {
  status: string;
  first_seen_at: string;
  ghost_override: boolean;
};

export type LlmSignal = { kind: string; text: string; evidence: string; points: number };

export type Evidence = {
  live: LiveStatus;
  live_source: string | null;
  known: KnownPosting | null;
  /** Other live postings with the same company + title + location. */
  repost_others: number;
  llm: LlmSignal[];
  /** The AI reviewer ran (even if it found nothing). */
  ai_reviewed: boolean;
  now?: Date;
};

export type Verdict = {
  verdict: "pass" | "no_pass";
  score: number;
  confidence: "high" | "medium" | "low";
  summary: string;
  signals: Signal[];
  checks: {
    live: LiveStatus;
    live_source: string | null;
    known_to_savant: boolean;
    age_days: number | null;
    repost_count: number;
    description_read: boolean;
    ai_reviewed: boolean;
  };
};

// Duplicated in extension-coach/content.js (the page-side reader); keep them in step.
export const CLOSED_RE =
  /\b(no longer (accepting|available|open|taking)|(position|job|role|posting|requisition|vacancy) (has been |is |was )?(filled|closed|expired|removed|cancell?ed)|(this|the) (job|position|posting|role) (has )?(expired|been (closed|filled|removed))|applications? (are |is )?(now )?closed|not (currently )?accepting (new )?applications|job (is )?no longer|we('| a)re no longer (hiring|accepting))\b/i;

const DAY = 86_400_000;

/** "Posted 30+ days ago", "2 weeks ago", "a month ago", "over a year ago" → days. */
export function parsePostedText(text: string | null): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\b(today|just posted|few hours|hours? ago|minutes? ago)\b/.test(t)) return 0;
  if (/\byesterday\b/.test(t)) return 1;
  if (/\b(over|more than) a year\b/.test(t)) return 366;
  const m = /(\d+|an?)\+?\s*(day|week|month|year)s?\s+ago/.exec(t);
  if (!m) return null;
  const n = m[1].startsWith("a") ? 1 : Number(m[1]);
  const unit = { day: 1, week: 7, month: 30, year: 365 }[m[2] as "day" | "week" | "month" | "year"];
  return n * unit;
}

/** Normalised host + path, so tracking params and trailing slashes don't split one posting. */
export function urlKey(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return raw.toLowerCase().slice(0, 300);
  }
}

/** The URL if it is a public web address we may fetch; null for localhost, raw IPs, creds, non-http. */
export function publicHttpUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || h === "localhost") return null;
  if (/\.(localhost|local|internal|lan|home)$/.test(h)) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":") || h.startsWith("[")) return null;
  return u;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function analyzeListing(input: ListingInput, ev: Evidence): Verdict {
  const now = ev.now ?? new Date();
  const signals: Signal[] = [];
  const block = (id: string, text: string, evidence?: string) =>
    signals.push({ id, severity: "block", text, ...(evidence ? { evidence } : {}) });

  // ---- hard stops: the posting is not open, or is a scam
  if (ev.live === "closed")
    block("board_closed", `The ${ev.live_source ?? "hiring"} board no longer lists this posting`);
  if (input.closed_banner)
    block(
      "closed_banner",
      "The page says it is no longer accepting applications",
      clip(input.closed_banner, 160),
    );
  if (input.valid_through && new Date(input.valid_through).getTime() < now.getTime())
    block(
      "expired",
      `The posting's own expiry date has passed (${input.valid_through.slice(0, 10)})`,
    );
  if (ev.known?.status === "closed")
    block(
      "savant_closed",
      "Savant's scout already closed this posting (it dropped off the company's board)",
    );

  // ---- the scout's explainable score, fed with what we know about this posting
  const age = parsePostedText(input.posted_text);
  const postedAt =
    input.posted_at ?? (age !== null ? new Date(now.getTime() - age * DAY).toISOString() : null);
  const ghost = scoreGhost({
    title: input.title ?? "",
    description: input.description,
    descriptionAvailable: input.description_read,
    location: input.location,
    posted_at: postedAt,
    first_seen_at: ev.known?.first_seen_at ?? null,
    sameFingerprintOthers: ev.repost_others,
    now,
  });
  let score = ghost.score;
  for (const reason of ghost.reasons) {
    if (reason.startsWith("Likely scam")) block("scam", reason);
    else signals.push({ id: "scout", severity: "warn", text: reason });
  }

  // ---- extras only a live look can see
  if (input.reposted) {
    score += 15;
    signals.push({
      id: "reposted_text",
      severity: "warn",
      points: 15,
      text: "The page says this role was reposted",
    });
  }
  if (input.apply_control === false && !input.closed_banner) {
    score += 10;
    signals.push({
      id: "no_apply",
      severity: "warn",
      points: 10,
      text: "No Apply button or link on the page",
    });
  }
  let llmPoints = 0;
  for (const s of ev.llm) {
    const pts = Math.min(15, Math.max(0, Math.round(s.points)), 30 - llmPoints);
    if (pts <= 0) continue;
    llmPoints += pts;
    score += pts;
    signals.push({
      id: `ai_${s.kind}`,
      severity: "warn",
      points: pts,
      text: s.text,
      evidence: s.evidence,
    });
  }
  score = Math.min(100, score);

  if (ev.known?.ghost_override)
    signals.push({
      id: "admin_real",
      severity: "info",
      text: "A Savant admin marked this posting as real",
    });

  const blocked = signals.some((s) => s.severity === "block");
  const noPass = blocked || (score >= GHOST_FLAG_THRESHOLD && !ev.known?.ghost_override);

  const confidence: Verdict["confidence"] =
    blocked || ev.live !== "unknown" ? "high" : input.description_read ? "medium" : "low";

  const lead = signals.filter((s) => s.severity !== "info");
  const summary = noPass
    ? `Don't recommend: ${lead
        .slice(0, 2)
        .map((s) => s.text.replace(/^./, (c) => c.toLowerCase()))
        .join("; ")}.`
    : confidence === "low"
      ? "No ghost signals, but the page could not be read, so open it and check before recommending."
      : lead.length
        ? `Looks real, with minor flags: ${lead[0].text.replace(/^./, (c) => c.toLowerCase())}.`
        : "No ghost signals found.";

  return {
    verdict: noPass ? "no_pass" : "pass",
    score,
    confidence,
    summary,
    signals: signals.sort((a, b) => rank(a.severity) - rank(b.severity)),
    checks: {
      live: ev.live,
      live_source: ev.live_source,
      known_to_savant: !!ev.known,
      age_days: postedAt
        ? Math.max(0, Math.round((now.getTime() - new Date(postedAt).getTime()) / DAY))
        : null,
      repost_count: ev.repost_others,
      description_read: input.description_read,
      ai_reviewed: ev.ai_reviewed,
    },
  };
}

const rank = (s: Signal["severity"]) => ({ block: 0, warn: 1, info: 2 })[s];
