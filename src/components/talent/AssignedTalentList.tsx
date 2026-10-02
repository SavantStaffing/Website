import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge, Empty, label, list, mutedButton, timeAgo } from "@/components/site/ui";

/** How long a résumé link opened from here stays valid. */
const RESUME_LINK_SECONDS = 600;

type Assigned = {
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
};

const yesNo = (v: boolean | null) => (v === null ? "—" : v ? "Yes" : "No");

/**
 * The talent an admin assigned to this recruiter or coach, with everything
 * assignment unlocks (row-level security: public.is_assigned): full profile,
 * contact details, job preferences and the résumé file.
 */
export function AssignedTalentList({ staffId, emptyText }: { staffId: string; emptyText: string }) {
  const [rows, setRows] = useState<Assigned[] | null>(null);
  const [openResume, setOpenResume] = useState<string | null>(null);

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
      const ids = (assignments ?? []).map((a) => a.talent_id);
      if (!ids.length) return setRows([]);
      const [{ data: profiles }, { data: tps }, { data: prefs }] = await Promise.all([
        supabase.from("profiles").select("id, username, email, phone").in("id", ids),
        supabase.from("talent_profiles").select("*").in("user_id", ids),
        supabase
          .from("talent_preferences")
          .select("user_id, positions, locations, employment_types, remote_ok, job_track")
          .in("user_id", ids),
      ]);
      const p = new Map((profiles ?? []).map((x) => [x.id, x]));
      const t = new Map((tps ?? []).map((x) => [x.user_id, x]));
      const w = new Map((prefs ?? []).map((x) => [x.user_id, x]));
      setRows(
        (assignments ?? []).map((a) => {
          const pr = p.get(a.talent_id);
          const tp = t.get(a.talent_id);
          const pf = w.get(a.talent_id);
          const links = [
            ["LinkedIn", tp?.linkedin_url],
            ["GitHub", tp?.github_url],
            ["Portfolio", tp?.portfolio_url],
          ]
            .filter(([, url]) => !!url)
            .map(([l, url]) => ({ label: l as string, url: url as string }));
          return {
            assignmentId: a.id,
            talentId: a.talent_id,
            note: a.note,
            since: a.decided_at ?? a.created_at,
            name:
              [tp?.first_name, tp?.last_name].filter(Boolean).join(" ") ||
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
          };
        }),
      );
    })();
  }, [staffId]);

  async function downloadResume(path: string) {
    const { data, error } = await supabase.storage
      .from("resumes")
      .createSignedUrl(path, RESUME_LINK_SECONDS);
    if (error || !data) return toast.error(error?.message ?? "Couldn't open the résumé");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (!rows) return <Empty>Loading…</Empty>;
  if (!rows.length) return <Empty>{emptyText}</Empty>;

  return (
    <ul className={`mt-6 ${list}`}>
      {rows.map((r) => (
        <li key={r.assignmentId} className="py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xl font-medium">{r.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {[
                  r.headline,
                  r.title && r.company ? `${r.title} at ${r.company}` : r.title,
                  r.location,
                ]
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
            {r.resumePath ? (
              <button onClick={() => downloadResume(r.resumePath!)} className={mutedButton}>
                Open résumé{r.resumeFilename ? ` (${r.resumeFilename})` : ""} ↗
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">No résumé file uploaded</span>
            )}
            {r.resumeText && (
              <button
                onClick={() => setOpenResume(openResume === r.talentId ? null : r.talentId)}
                className={mutedButton}
                aria-expanded={openResume === r.talentId}
              >
                {openResume === r.talentId ? "Hide résumé text" : "Read résumé text"}
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
          {openResume === r.talentId && r.resumeText && (
            <pre className="mt-4 max-h-96 max-w-4xl overflow-auto whitespace-pre-wrap rounded-sm border border-[color:var(--color-hairline)] p-4 font-sans text-sm leading-relaxed">
              {r.resumeText}
            </pre>
          )}
        </li>
      ))}
    </ul>
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
