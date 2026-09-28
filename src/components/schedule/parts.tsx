import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge, label, linkButton, mutedButton, selectCls, timeAgo } from "@/components/site/ui";
import { APPLICATION_STATUS_LABEL, RECRUITER_STATUSES } from "@/lib/applications";
import { SERVICE_LABEL, SERVICE_STATUS_LABEL, type ServiceId } from "@/lib/services";

/**
 * Building blocks for the Talent & Schedule pages (coach, recruiter, admin):
 * who's been assigned or picked for something, and when it happens.
 */

export type Person = { name: string; email: string | null; phone: string | null };

/** Display names for a set of users. RLS decides what each viewer may see. */
export function usePeople(ids: (string | null | undefined)[]) {
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const key = [...new Set(ids.filter(Boolean))].sort().join(",");
  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (!list.length) return;
    (async () => {
      const [{ data: profiles }, { data: tps }] = await Promise.all([
        supabase.from("profiles").select("id, username, email, phone").in("id", list),
        supabase
          .from("talent_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", list),
      ]);
      const names = new Map(
        (tps ?? []).map((t) => [t.user_id, [t.first_name, t.last_name].filter(Boolean).join(" ")]),
      );
      const map = new Map<string, Person>();
      for (const id of list) {
        const p = profiles?.find((x) => x.id === id);
        map.set(id, {
          name: names.get(id) || p?.username || p?.email || "Talent",
          email: p?.email ?? null,
          phone: p?.phone ?? null,
        });
      }
      setPeople(map);
    })();
  }, [key]);
  return people;
}

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const isFuture = (iso: string | null) => !!iso && new Date(iso).getTime() >= Date.now();

// <input type="datetime-local"> works in local time without a zone.
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/** Date/time + note, saved together. Clearing the time unschedules. */
export function ScheduleEditor({
  at,
  note,
  onSave,
  cta = "Schedule",
}: {
  at: string | null;
  note: string | null;
  onSave: (at: string | null, note: string | null) => Promise<void>;
  cta?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState(toLocalInput(at));
  const [text, setText] = useState(note ?? "");
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {at ? (
          <Badge tone={isFuture(at) ? "good" : "muted"}>{formatWhen(at)}</Badge>
        ) : (
          <Badge tone="warn">Not scheduled</Badge>
        )}
        <button onClick={() => setEditing(true)} className={linkButton}>
          {at ? "Reschedule" : `${cta} →`}
        </button>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    await onSave(when ? new Date(when).toISOString() : null, text.trim() || null);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="flex w-full flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className={label}>When</span>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="rounded-sm border border-[color:var(--color-hairline)] bg-transparent px-3 py-2 text-sm"
        />
      </label>
      <label className="flex min-w-[14rem] flex-1 flex-col gap-1">
        <span className={label}>Note for the talent (location, link…)</span>
        <input
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder="Zoom link, address, what to bring"
          className="rounded-sm border border-[color:var(--color-hairline)] bg-transparent px-3 py-2 text-sm"
        />
      </label>
      <button onClick={save} disabled={saving} className={linkButton}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button onClick={() => setEditing(false)} className={mutedButton}>
        Cancel
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service requests (coach sessions)
// ---------------------------------------------------------------------------

export type ServiceRequest = {
  id: string;
  talent_id: string;
  service: string;
  program: string | null;
  goals: string;
  availability: string | null;
  contact_method: string;
  phone: string | null;
  status: string;
  assigned_coach_id: string | null;
  scheduled_at: string | null;
  schedule_note: string | null;
  created_at: string;
};

const SERVICE_STATUSES = ["new", "in_progress", "completed", "cancelled"] as const;

export async function updateServiceRequest(id: string, patch: Partial<ServiceRequest>) {
  const { error } = await supabase.from("service_requests").update(patch).eq("id", id);
  if (error) {
    toast.error(error.message);
    return false;
  }
  return true;
}

export function ServiceRequestCard({
  r,
  people,
  viewerId,
  coaches,
  onChange,
}: {
  r: ServiceRequest;
  people: Map<string, Person>;
  viewerId: string;
  /** Admin only: coaches to assign from. */
  coaches?: { id: string; name: string }[];
  onChange: (patch: Partial<ServiceRequest>) => void;
}) {
  const talent = people.get(r.talent_id);
  const coach = r.assigned_coach_id ? people.get(r.assigned_coach_id) : null;

  async function apply(patch: Partial<ServiceRequest>) {
    if (await updateServiceRequest(r.id, patch)) onChange(patch);
  }

  return (
    <li className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-medium">{talent?.name ?? "Talent"}</span>
            <Badge>{SERVICE_LABEL[r.service as ServiceId] ?? r.service}</Badge>
            {r.program && <Badge>{r.program}</Badge>}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {r.contact_method === "phone" ? (r.phone ?? "—") : (talent?.email ?? "—")} · signed up{" "}
            {timeAgo(r.created_at)}
            {!coaches &&
              coach &&
              ` · coach: ${r.assigned_coach_id === viewerId ? "you" : coach.name}`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {coaches && (
            <select
              value={r.assigned_coach_id ?? ""}
              onChange={(e) =>
                apply({
                  assigned_coach_id: e.target.value || null,
                  ...(e.target.value && r.status === "new" ? { status: "in_progress" } : {}),
                })
              }
              className={selectCls}
              aria-label="Assigned coach"
            >
              <option value="">Unassigned</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={r.status}
            onChange={(e) => apply({ status: e.target.value })}
            className={selectCls}
            aria-label="Status"
          >
            {SERVICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SERVICE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-3 max-w-3xl whitespace-pre-line text-sm">{r.goals}</p>
      {r.availability && (
        <p className="mt-2 text-xs text-muted-foreground">Availability: {r.availability}</p>
      )}
      <div className="mt-4">
        <ScheduleEditor
          at={r.scheduled_at}
          note={r.schedule_note}
          cta="Schedule session"
          onSave={(scheduled_at, schedule_note) => apply({ scheduled_at, schedule_note })}
        />
        {r.schedule_note && (
          <p className="mt-2 text-xs text-muted-foreground">Note: {r.schedule_note}</p>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Job applications (recruiter interviews)
// ---------------------------------------------------------------------------

export type Application = {
  id: string;
  job_id: string;
  applicant_id: string;
  status: string;
  interview_at: string | null;
  interview_note: string | null;
  created_at: string;
  jobTitle: string;
  company: string | null;
};

export function ApplicationCard({
  a,
  people,
  onChange,
}: {
  a: Application;
  people: Map<string, Person>;
  onChange: (patch: Partial<Application>) => void;
}) {
  const talent = people.get(a.applicant_id);

  async function apply(
    patch: Partial<Pick<Application, "status" | "interview_at" | "interview_note">>,
  ) {
    const { error } = await supabase.from("job_applications").update(patch).eq("id", a.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChange(patch);
  }

  return (
    <li className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-lg font-medium">{talent?.name ?? "Applicant"}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {a.jobTitle}
            {a.company && ` · ${a.company}`} · applied {timeAgo(a.created_at)}
            {talent?.email && ` · ${talent.email}`}
            {talent?.phone && ` · ${talent.phone}`}
          </div>
        </div>
        <select
          value={a.status}
          onChange={(e) => apply({ status: e.target.value })}
          className={selectCls}
          aria-label="Application status"
        >
          {!RECRUITER_STATUSES.includes(a.status as never) && (
            <option value={a.status}>{APPLICATION_STATUS_LABEL[a.status] ?? a.status}</option>
          )}
          {RECRUITER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPLICATION_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4">
        <ScheduleEditor
          at={a.interview_at}
          note={a.interview_note}
          cta="Schedule interview"
          onSave={(interview_at, interview_note) =>
            apply({
              interview_at,
              interview_note,
              ...(interview_at && a.status !== "interviewing" ? { status: "interviewing" } : {}),
            })
          }
        />
        {a.interview_note && (
          <p className="mt-2 text-xs text-muted-foreground">Note: {a.interview_note}</p>
        )}
      </div>
    </li>
  );
}

/** Splits scheduled items into upcoming (soonest first) and the rest. */
export function splitUpcoming<T>(rows: T[], at: (r: T) => string | null) {
  const upcoming = rows
    .filter((r) => isFuture(at(r)))
    .sort((x, y) => new Date(at(x)!).getTime() - new Date(at(y)!).getTime());
  return { upcoming, rest: rows.filter((r) => !isFuture(at(r))) };
}
