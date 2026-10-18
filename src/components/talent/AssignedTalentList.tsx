import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { personName } from "@/lib/people";
import {
  Badge,
  Empty,
  label,
  list,
  mutedButton,
  outlineButton,
  timeAgo,
} from "@/components/site/ui";
import { intakeSummary, type IntakeRow } from "@/lib/talent/intake";
import { MeetingRequestForm, type MeetingKind } from "@/components/meetings/MeetingRequests";

/** How long a résumé link opened from here stays valid. */
const RESUME_LINK_SECONDS = 600;

export type Assigned = {
  assignmentId: string;
  talentId: string;
  note: string | null;
  since: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  headline: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  skills: string[];
  links: { label: string; url: string }[];
  workAuthorized: boolean | null;
  needsSponsorship: boolean | null;
  earliestStart: string | null;
  salary: string | null;
  resumePath: string | null;
  resumeFilename: string | null;
  resumeText: string | null;
  wants: string[];
  intake: ReturnType<typeof intakeSummary> | null;
  intakeAt: string | null;
};

const yesNo = (v: boolean | null) => (v === null ? "—" : v ? "Yes" : "No");

/**
 * The talent an admin assigned to this recruiter or coach, with everything
 * assignment unlocks (row-level security: public.is_assigned): full profile,
 * contact details, job preferences and the résumé file.
 * Coaches (canRequestMeetings) can also ask each one to meet.
 */
export function AssignedTalentList({
  staffId,
  emptyText,
  canRequestMeetings = false,
  profileLinks = false,
}: {
  staffId: string;
  emptyText: string;
  canRequestMeetings?: boolean;
  /** Names link to the coach's page for each talent. */
  profileLinks?: boolean;
}) {
  const [rows, setRows] = useState<Assigned[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: assignments, error } = await supabase
        .from("talent_assignments")
        .select("id, talent_id, note, decided_at, created_at")
        .eq("staff_id", staffId)
        .eq("status", "active")
        .order("decided_at", { ascending: false });
      if (error) {
        toast.error(error.message);
        return setRows([]);
      }
      setRows(
        await loadTalent(
          (assignments ?? []).map((a) => ({
            assignmentId: a.id,
            talentId: a.talent_id,
            note: a.note,
            since: a.decided_at ?? a.created_at,
          })),
        ),
      );
    })();
  }, [staffId]);

  if (!rows) return <Empty>Loading…</Empty>;
  if (!rows.length) return <Empty>{emptyText}</Empty>;

  return (
    <ul className={`mt-6 ${list}`}>
      {rows.map((r) => (
        <li key={r.assignmentId} className="py-6">
          <TalentProfile
            r={r}
            staffId={staffId}
            canRequestMeetings={canRequestMeetings}
            profileLink={profileLinks}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * Everything assignment unlocks for these talent (row-level security:
 * public.is_assigned). Talent the viewer can't read are left out.
 */
export async function loadTalent(
  entries: Pick<Assigned, "assignmentId" | "talentId" | "note" | "since">[],
): Promise<Assigned[]> {
  const ids = entries.map((e) => e.talentId);
  if (!ids.length) return [];
  const [{ data: profiles }, { data: tps }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, email, phone").in("id", ids),
    supabase.from("talent_profiles").select("*").in("user_id", ids),
    supabase
      .from("talent_preferences")
      .select(
        "user_id, positions, locations, employment_types, remote_ok, job_track, intake_industry, intake_industry_other, intake_role, intake_role_other, home_zip, home_state, home_metro, travel_miles, availability, intake_completed_at",
      )
      .in("user_id", ids),
  ]);
  const p = new Map((profiles ?? []).map((x) => [x.id, x]));
  const t = new Map((tps ?? []).map((x) => [x.user_id, x]));
  const w = new Map((prefs ?? []).map((x) => [x.user_id, x]));
  return entries
    .filter((a) => t.has(a.talentId) || p.has(a.talentId))
    .map((a) => {
      const pr = p.get(a.talentId);
      const tp = t.get(a.talentId);
      const pf = w.get(a.talentId);
      const links = [
        ["LinkedIn", tp?.linkedin_url],
        ["GitHub", tp?.github_url],
        ["Portfolio", tp?.portfolio_url],
      ]
        .filter(([, url]) => !!url)
        .map(([l, url]) => ({ label: l as string, url: url as string }));
      return {
        ...a,
        name:
          [tp?.first_name, tp?.last_name].filter(Boolean).join(" ") ||
          pr?.full_name ||
          pr?.username ||
          pr?.email ||
          "Talent",
        email: pr?.email ?? null,
        phone: pr?.phone ?? null,
        headline: tp?.headline ?? null,
        title: tp?.current_title ?? null,
        company: tp?.current_company ?? null,
        location: tp?.location ?? null,
        skills: tp?.skills ?? [],
        links,
        workAuthorized: tp?.work_authorized ?? null,
        needsSponsorship: tp?.needs_sponsorship ?? null,
        earliestStart: tp?.earliest_start ?? null,
        salary: tp?.salary_expectation ?? null,
        resumePath: tp?.resume_path ?? null,
        resumeFilename: tp?.resume_filename ?? null,
        resumeText: tp?.resume_text ?? null,
        wants: [
          ...(pf?.positions ?? []),
          ...(pf?.locations ?? []),
          ...(pf?.employment_types ?? []).map((e: string) => e.replace("_", " ")),
          ...(pf?.remote_ok ? ["Open to remote"] : []),
        ],
        intake: pf?.intake_completed_at ? intakeSummary(pf as IntakeRow) : null,
        intakeAt: pf?.intake_completed_at ?? null,
      };
    });
}

/** One talent's profile: details, résumé, links, and (coaches) meeting requests. */
export function TalentProfile({
  r,
  staffId,
  canRequestMeetings = false,
  profileLink = false,
}: {
  r: Assigned;
  staffId: string;
  canRequestMeetings?: boolean;
  /** Name links to the coach's page for this talent. */
  profileLink?: boolean;
}) {
  const [openResume, setOpenResume] = useState(false);
  const [meeting, setMeeting] = useState<MeetingKind | null>(null);

  async function downloadResume(path: string) {
    const { data, error } = await supabase.storage
      .from("resumes")
      .createSignedUrl(path, RESUME_LINK_SECONDS);
    if (error || !data) return toast.error(error?.message ?? "Couldn't open the résumé");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {profileLink ? (
            <Link
              to="/coach/talent/$talentId"
              params={{ talentId: r.talentId }}
              className="text-xl font-medium underline-offset-4 [@media(hover:hover)]:hover:underline"
            >
              {r.name} →
            </Link>
          ) : (
            <div className="text-xl font-medium">{r.name}</div>
          )}
          <div className="mt-1 text-sm text-muted-foreground">
            {[r.headline, r.title && r.company ? `${r.title} at ${r.company}` : r.title, r.location]
              .filter(Boolean)
              .join(" · ") || "Profile not filled in yet"}
          </div>
        </div>
        <div className="text-right text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Assigned {timeAgo(r.since)}
        </div>
      </div>

      {r.note && (
        <p className="mt-3 max-w-3xl border-l-2 border-[color:var(--color-hairline)] pl-3 text-sm text-muted-foreground">
          From admin: {r.note}
        </p>
      )}

      <dl className="mt-4 grid max-w-4xl gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Info term="Email">
          {r.email ? (
            <a href={`mailto:${r.email}`} className="underline underline-offset-4">
              {r.email}
            </a>
          ) : (
            "—"
          )}
        </Info>
        <Info term="Phone">{r.phone || "—"}</Info>
        <Info term="Earliest start">{r.earliestStart || "—"}</Info>
        <Info term="Authorized to work in the U.S.">{yesNo(r.workAuthorized)}</Info>
        <Info term="Needs sponsorship">{yesNo(r.needsSponsorship)}</Info>
        <Info term="Salary expectation">{r.salary || "—"}</Info>
      </dl>

      {r.intake ? (
        <div className="mt-4">
          <div className={label}>Intake · {timeAgo(r.intakeAt)}</div>
          <dl className="mt-2 grid max-w-4xl gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Info term="Industry">{r.intake.industry || "—"}</Info>
            <Info term="Role">{r.intake.role || "—"}</Info>
            <Info term="Home ZIP">{r.intake.home || "—"}</Info>
            <Info term="Will travel">{r.intake.travel}</Info>
            <Info term="Availability">{r.intake.availability}</Info>
          </dl>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">Intake not completed yet.</p>
      )}

      {r.wants.length > 0 && (
        <div className="mt-4">
          <div className={label}>Looking for</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {r.wants.map((x) => (
              <Badge key={x}>{x}</Badge>
            ))}
          </div>
        </div>
      )}
      {r.skills.length > 0 && (
        <div className="mt-4">
          <div className={label}>Skills</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {r.skills.map((s) => (
              <Badge key={s} tone="good">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        {canRequestMeetings && (
          <>
            <button onClick={() => setMeeting("intro")} className={outlineButton}>
              Request intro meeting
            </button>
            <button onClick={() => setMeeting("general")} className={outlineButton}>
              Request meeting
            </button>
          </>
        )}
        {r.resumePath ? (
          <button onClick={() => downloadResume(r.resumePath!)} className={mutedButton}>
            Open résumé{r.resumeFilename ? ` (${r.resumeFilename})` : ""} ↗
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">No résumé file uploaded</span>
        )}
        {r.resumeText && (
          <button
            onClick={() => setOpenResume((o) => !o)}
            className={mutedButton}
            aria-expanded={openResume}
          >
            {openResume ? "Hide résumé text" : "Read résumé text"}
          </button>
        )}
        {r.links.map((l) => (
          <a
            key={l.label}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className={mutedButton}
          >
            {l.label} ↗
          </a>
        ))}
      </div>
      {meeting && (
        <MeetingRequestForm
          key={meeting}
          coachId={staffId}
          talentId={r.talentId}
          talentName={r.name}
          kind={meeting}
          onClose={() => setMeeting(null)}
        />
      )}
      {openResume && r.resumeText && (
        <pre className="mt-4 max-h-96 max-w-4xl overflow-auto whitespace-pre-wrap rounded-sm border border-[color:var(--color-hairline)] p-4 font-sans text-sm leading-relaxed">
          {r.resumeText}
        </pre>
      )}
    </>
  );
}

function Info({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{term}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
