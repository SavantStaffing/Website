import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatWhen } from "@/components/schedule/parts";
import {
  Badge,
  Empty,
  SectionHeading,
  label,
  linkButton,
  list,
  mutedButton,
  outlineButton,
  selectCls,
  timeAgo,
} from "@/components/site/ui";

/**
 * Meeting requests (migration 20261018000001): a coach offers an assigned
 * talent three times for an introductory or general meeting; the talent picks
 * one or says none work. Accepted meetings land on both calendars.
 */

export type MeetingRequest = Database["public"]["Tables"]["meeting_requests"]["Row"];
export type MeetingKind = "intro" | "general";

const KIND_LABEL: Record<string, string> = {
  intro: "Introductory meeting",
  general: "Meeting",
};
const STATUS: Record<string, { text: string; tone: "good" | "warn" | "muted" }> = {
  pending: { text: "Waiting for a reply", tone: "warn" },
  accepted: { text: "Confirmed", tone: "good" },
  declined: { text: "None of the times worked", tone: "muted" },
  cancelled: { text: "Cancelled", tone: "muted" },
};
const LENGTHS = [15, 30, 45, 60, 90];
const inputCls =
  "rounded-sm border border-[color:var(--color-hairline)] bg-transparent px-3 py-2 text-sm";

// <input type="datetime-local"> works in local time without a zone.
const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const endOf = (m: MeetingRequest) =>
  m.chosen_at ? new Date(m.chosen_at).getTime() + m.duration_minutes * 60000 : 0;

// ---------------------------------------------------------------------------
// Coach: the request form, opened from a talent profile
// ---------------------------------------------------------------------------

export function MeetingRequestForm({
  coachId,
  talentId,
  talentName,
  kind,
  onClose,
}: {
  coachId: string;
  talentId: string;
  talentName: string;
  kind: MeetingKind;
  onClose: () => void;
}) {
  const [times, setTimes] = useState(["", "", ""]);
  const [minutes, setMinutes] = useState(30);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (times.some((t) => !t)) return toast.error("Offer three times.");
    const iso = times.map((t) => new Date(t).toISOString());
    if (iso.some((t) => new Date(t).getTime() <= Date.now()))
      return toast.error("All three times need to be in the future.");
    if (new Set(iso).size < 3) return toast.error("Offer three different times.");
    if (kind === "general" && !text.trim())
      return toast.error("Describe what the meeting is about.");
    setSending(true);
    const { error } = await supabase.from("meeting_requests").insert({
      requester_id: coachId,
      talent_id: talentId,
      kind,
      options: iso,
      duration_minutes: minutes,
      description: text.trim() || null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success(`Sent. ${talentName} will pick one of the times.`);
    onClose();
  }

  const min = localNow();
  return (
    <div className="mt-5 max-w-3xl rounded-sm border border-[color:var(--color-hairline)] p-5">
      <div className="text-lg font-medium">
        {KIND_LABEL[kind]} with {talentName}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Offer three times. {talentName} picks one in their dashboard, and it goes on both of your
        calendars.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {times.map((t, i) => (
          <label key={i} className="flex flex-col gap-1">
            <span className={label}>Option {i + 1}</span>
            <input
              type="datetime-local"
              value={t}
              min={min}
              onChange={(e) =>
                setTimes((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
              }
              className={inputCls}
            />
          </label>
        ))}
      </div>
      <label className="mt-4 flex flex-col gap-1">
        <span className={label}>Length</span>
        <select
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className={`${selectCls} w-fit`}
        >
          {LENGTHS.map((m) => (
            <option key={m} value={m}>
              {m} minutes
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 flex flex-col gap-1">
        <span className={label}>
          {kind === "general" ? "What's the meeting about?" : "Note (optional)"}
        </span>
        <textarea
          value={text}
          rows={kind === "general" ? 4 : 2}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            kind === "general"
              ? "Agenda, what to prepare, and the Zoom or Google Meet link"
              : "Zoom or Google Meet link, anything to prepare"
          }
          className={`${inputCls} w-full`}
        />
      </label>
      <div className="mt-5 flex flex-wrap items-center gap-6">
        <button onClick={send} disabled={sending} className={outlineButton}>
          {sending ? "Sending…" : "Send request"}
        </button>
        <button onClick={onClose} className={mutedButton}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coach: requests sent, on the Schedule page
// ---------------------------------------------------------------------------

export function CoachMeetingRequests({
  userId,
  onChange,
}: {
  userId: string;
  onChange?: () => void;
}) {
  const [rows, setRows] = useState<MeetingRequest[] | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("meeting_requests")
      .select("*")
      .eq("requester_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setRows(data ?? []);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(m: MeetingRequest) {
    if (!window.confirm(`Cancel this ${KIND_LABEL[m.kind].toLowerCase()} with ${m.talent_name}?`))
      return;
    const { error } = await supabase.rpc("cancel_meeting_request", { _id: m.id });
    if (error) return toast.error(error.message);
    toast.success("Cancelled. They've been notified.");
    void load();
    onChange?.();
  }

  // Open: waiting for a reply, or confirmed and not over yet. Recent: replies
  // from the last two weeks that didn't end in a meeting.
  const now = Date.now();
  const twoWeeks = 14 * 86_400_000;
  const open = (rows ?? []).filter(
    (m) => m.status === "pending" || (m.status === "accepted" && endOf(m) > now),
  );
  const recent = (rows ?? []).filter(
    (m) =>
      m.status === "declined" &&
      new Date(m.responded_at ?? m.created_at).getTime() > now - twoWeeks,
  );
  const shown = [...open, ...recent];

  return (
    <div>
      <SectionHeading title="Meeting requests">
        <Link to="/coach/talent" className={mutedButton}>
          Request a meeting →
        </Link>
      </SectionHeading>
      {!rows ? (
        <Empty>Loading…</Empty>
      ) : shown.length === 0 ? (
        <Empty>
          No open requests. Open a profile under Talent and choose Request intro meeting or Request
          meeting.
        </Empty>
      ) : (
        <ul className={`mt-6 ${list}`}>
          {shown.map((m) => (
            <li key={m.id} className="flex flex-wrap items-start justify-between gap-4 py-5">
              <div className="min-w-0 max-w-3xl">
                <div className="text-lg font-medium">
                  {KIND_LABEL[m.kind]} with {m.talent_name ?? "talent"}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].text}</Badge>
                  {m.status === "accepted" && m.chosen_at ? (
                    <Badge tone="good">
                      {formatWhen(m.chosen_at)} · {m.duration_minutes} min
                    </Badge>
                  ) : m.status === "pending" ? (
                    m.options.map((o) => <Badge key={o}>{formatWhen(o)}</Badge>)
                  ) : null}
                </div>
                {m.description && (
                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                    {m.description}
                  </p>
                )}
                {m.talent_note && (
                  <p className="mt-2 border-l-2 border-[color:var(--color-hairline)] pl-3 text-sm">
                    {m.talent_name ?? "They"} wrote: {m.talent_note}
                  </p>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                  Sent {timeAgo(m.created_at)}
                </div>
              </div>
              {(m.status === "pending" || m.status === "accepted") && (
                <button onClick={() => cancel(m)} className={mutedButton}>
                  Cancel meeting
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Talent: pick a time or say none work
// ---------------------------------------------------------------------------

export function TalentMeetingRequests({
  userId,
  onChange,
}: {
  userId: string;
  onChange?: () => void;
}) {
  const [rows, setRows] = useState<MeetingRequest[] | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("meeting_requests")
      .select("*")
      .eq("talent_id", userId)
      .in("status", ["pending", "accepted"])
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(data ?? []);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function respond(m: MeetingRequest, choice: string | null) {
    setBusy(m.id);
    const { error } = await supabase.rpc("respond_meeting_request", {
      _id: m.id,
      _choice: choice,
      _note: choice ? null : note.trim() || null,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(
      choice
        ? `Confirmed for ${formatWhen(choice)}. It's on your calendar.`
        : `Sent. ${m.requester_name ?? "Your coach"} will suggest other times.`,
    );
    setDeclining(null);
    setNote("");
    void load();
    onChange?.();
  }

  const now = Date.now();
  const pending = (rows ?? []).filter(
    (m) => m.status === "pending" && m.options.some((o) => new Date(o).getTime() > now),
  );
  const confirmed = (rows ?? []).filter((m) => m.status === "accepted" && endOf(m) > now);
  if (!rows || (pending.length === 0 && confirmed.length === 0)) return null;

  return (
    <div>
      <SectionHeading title="Meetings with your coach" />
      <ul className={`mt-6 ${list}`}>
        {pending.map((m) => (
          <li key={m.id} className="py-5">
            <div className="text-lg font-medium">
              {KIND_LABEL[m.kind]} with {m.requester_name ?? "your coach"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Requested {timeAgo(m.created_at)} · {m.duration_minutes} minutes
            </div>
            {m.description && (
              <p className="mt-2 max-w-2xl whitespace-pre-line text-sm">{m.description}</p>
            )}
            <div className={`mt-4 ${label}`}>Pick a time</div>
            <div className="mt-2 flex flex-wrap gap-3">
              {m.options.map((o) => {
                const past = new Date(o).getTime() <= now;
                return (
                  <button
                    key={o}
                    onClick={() => respond(m, o)}
                    disabled={busy === m.id || past}
                    title={past ? "This time has passed" : undefined}
                    className={outlineButton}
                  >
                    {formatWhen(o)}
                  </button>
                );
              })}
            </div>
            {declining === m.id ? (
              <div className="mt-4 flex max-w-2xl flex-wrap items-end gap-3">
                <label className="flex min-w-[14rem] flex-1 flex-col gap-1">
                  <span className={label}>When works for you? (optional)</span>
                  <input
                    value={note}
                    maxLength={500}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. weekday mornings, or after 4 PM"
                    className={inputCls}
                  />
                </label>
                <button
                  onClick={() => respond(m, null)}
                  disabled={busy === m.id}
                  className={linkButton}
                >
                  Send
                </button>
                <button onClick={() => setDeclining(null)} className={mutedButton}>
                  Back
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setDeclining(m.id);
                  setNote("");
                }}
                className={`mt-4 ${mutedButton}`}
              >
                None of these work
              </button>
            )}
          </li>
        ))}
        {confirmed.map((m) => (
          <li key={m.id} className="flex flex-wrap items-start justify-between gap-4 py-5">
            <div className="min-w-0">
              <div className="text-lg font-medium">
                {KIND_LABEL[m.kind]} with {m.requester_name ?? "your coach"}
              </div>
              <div className="mt-2">
                <Badge tone="good">
                  {formatWhen(m.chosen_at!)} · {m.duration_minutes} min
                </Badge>
              </div>
              {m.description && (
                <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-muted-foreground">
                  {m.description}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
