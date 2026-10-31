import { CoachRecommendations } from "@/components/talent/CoachRecommendations";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { APPLICATION_STATUS_LABEL } from "@/lib/applications";
import { loadTalent, TalentProfile, type Assigned } from "@/components/talent/AssignedTalentList";
import { EngagementProgress } from "@/components/talent/EngagementProgress";
import { CoachEditTalentProfile } from "@/components/talent/CoachEditTalentProfile";
import {
  Badge,
  Empty,
  SectionHeading,
  label,
  linkButton,
  list,
  mutedButton,
  outlineButton,
  timeAgo,
} from "@/components/site/ui";

export const Route = createFileRoute("/coach/talent_/$talentId")({
  head: () => ({
    meta: [{ title: "Talent profile" }, { name: "robots", content: "noindex" }],
  }),
  component: CoachTalentProfile,
});

/**
 * One of the coach's talent: their profile and résumé, and their job
 * activity as the talent sees it — shared with them, bookmarked, started,
 * applied (migration 20261019000000). The coach can only read it, plus add
 * to Shared: a Savant listing (share_job) or a link from another site
 * (share_external_job). What the talent removes disappears here too.
 */

type JobLite = {
  id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  apply_url: string | null;
};
type SharedRow = {
  id: string;
  shared_by_name: string;
  note: string | null;
  created_at: string;
  external_url: string | null;
  external_title: string | null;
  external_company: string | null;
  external_location: string | null;
  jobs: JobLite | null;
};
type SavedRow = { id: string; created_at: string; jobs: JobLite | null };
type AppRow = {
  id: string;
  status: string;
  created_at: string;
  external_url: string | null;
  external_title: string | null;
  external_company: string | null;
  external_location: string | null;
  jobs: JobLite | null;
};

type Tab = "shared" | "bookmarked" | "started" | "applied";
const TABS: { id: Tab; label: string }[] = [
  { id: "shared", label: "Shared" },
  { id: "bookmarked", label: "Bookmarked" },
  { id: "started", label: "Started applying" },
  { id: "applied", label: "Applied" },
];
/** Applications not yet sent: added by link, or opened on the company's site. */
const STARTED = new Set(["tracked", "started"]);

const JOB = "jobs (id, title, company_name, location, apply_url)";

function CoachTalentProfile() {
  const { userId } = Route.useRouteContext();
  const { talentId } = Route.useParams();
  const [profile, setProfile] = useState<Assigned | null | undefined>(undefined);
  const [shared, setShared] = useState<SharedRow[] | null>(null);
  const [saved, setSaved] = useState<SavedRow[] | null>(null);
  const [apps, setApps] = useState<AppRow[] | null>(null);
  const [tab, setTab] = useState<Tab>("shared");

  const loadProfile = useCallback(async () => {
    const { data: a } = await supabase.from("talent_assignments")
      .select("id, note, decided_at, created_at")
      .eq("staff_id", userId).eq("talent_id", talentId).eq("status", "active").maybeSingle();
    const [r] = await loadTalent([{
      assignmentId: a?.id ?? talentId, talentId, note: a?.note ?? null,
      since: a ? (a.decided_at ?? a.created_at) : null,
    }]);
    setProfile(r ?? null);
  }, [userId, talentId]);
  useEffect(() => { void loadProfile(); }, [loadProfile]);

  // The talent's lists, read fresh. Reloaded when the coach comes back to the
  // tab, so changes the talent made in the meantime show up.
  const loadJobs = useCallback(async () => {
    const [s, b, ap] = await Promise.all([
      supabase
        .from("shared_jobs")
        .select(
          `id, shared_by_name, note, created_at, external_url, external_title, external_company, external_location, ${JOB}`,
        )
        .eq("talent_id", talentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("saved_jobs")
        .select(`id, created_at, ${JOB}`)
        .eq("user_id", talentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("job_applications")
        .select(
          `id, status, created_at, external_url, external_title, external_company, external_location, ${JOB}`,
        )
        .eq("applicant_id", talentId)
        .is("archived_at", null)
        .order("created_at", { ascending: false }),
    ]);
    const err = s.error ?? b.error ?? ap.error;
    if (err) toast.error(err.message);
    setShared((s.data as unknown as SharedRow[]) ?? []);
    setSaved((b.data as unknown as SavedRow[]) ?? []);
    setApps((ap.data as unknown as AppRow[]) ?? []);
  }, [talentId]);

  useEffect(() => {
    void loadJobs();
    const onFocus = () => {
      if (document.visibilityState === "visible") void loadJobs();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [loadJobs]);

  if (profile === undefined) return <Empty>Loading…</Empty>;
  if (profile === null) {
    return (
      <section>
        <BackLink />
        <Empty>This profile is only available for talent assigned to you.</Empty>
      </section>
    );
  }

  const started = apps?.filter((a) => STARTED.has(a.status)) ?? null;
  const applied = apps?.filter((a) => !STARTED.has(a.status)) ?? null;
  const counts: Record<Tab, number | null> = {
    shared: shared?.length ?? null,
    bookmarked: saved?.length ?? null,
    started: started?.length ?? null,
    applied: applied?.length ?? null,
  };

  return (
    <section className="space-y-12">
      <div>
        <BackLink />
        <div className="mt-6">
          <TalentProfile r={profile} staffId={userId} canRequestMeetings />
          <CoachEditTalentProfile talentId={talentId} onSaved={loadProfile} />
        </div>
      </div>

      <CoachRecommendations talentId={talentId} canEdit />

      <div>
        <SectionHeading title="Engagement" />
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Where {profile.name} is in each Savant service. Click a service for its steps, and click a
          step to mark it done or undo it.
        </p>
        <div className="mt-6">
          <EngagementProgress talentId={talentId} canEdit bare />
        </div>
      </div>

      <div>
        <SectionHeading title="Jobs">
          <button onClick={() => void loadJobs()} className={mutedButton}>
            Refresh
          </button>
        </SectionHeading>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {profile.name}'s job activity, as they see it. You can share jobs; only they can remove
          things.
        </p>

        <div role="tablist" className="mt-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-sm border px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] ${
                tab === t.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-[color:var(--color-hairline)] text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
              }`}
            >
              {t.label}
              {counts[t.id] !== null && ` (${counts[t.id]})`}
            </button>
          ))}
        </div>

        {tab === "shared" && (
          <>
            <ShareJob talentId={talentId} talentName={profile.name} onShared={loadJobs} />
            <JobList
              rows={shared}
              empty="Nothing shared yet."
              render={(s) => ({
                key: s.id,
                ...jobInfo(s.jobs, s),
                meta: `from ${s.shared_by_name} · ${timeAgo(s.created_at)}`,
                note: s.note,
                badge: s.jobs ? null : "Other site",
              })}
            />
          </>
        )}
        {tab === "bookmarked" && (
          <JobList
            rows={saved}
            empty="No bookmarked jobs."
            render={(b) => ({
              key: b.id,
              ...jobInfo(b.jobs, null),
              meta: `bookmarked ${timeAgo(b.created_at)}`,
            })}
          />
        )}
        {(tab === "started" || tab === "applied") && (
          <JobList
            rows={tab === "started" ? started : applied}
            empty={tab === "started" ? "Nothing in progress." : "No applications sent yet."}
            render={(a) => ({
              key: a.id,
              ...jobInfo(a.jobs, a),
              meta: timeAgo(a.created_at),
              badge: APPLICATION_STATUS_LABEL[a.status] ?? a.status,
            })}
          />
        )}
      </div>
    </section>
  );
}

function BackLink() {
  return (
    <Link to="/coach/talent" className={mutedButton}>
      ← Talent
    </Link>
  );
}

type External = {
  external_url: string | null;
  external_title: string | null;
  external_company: string | null;
  external_location: string | null;
};

/** Title, place and link for a Savant listing or an outside one. */
function jobInfo(job: JobLite | null, ext: External | null) {
  return {
    title: job?.title ?? ext?.external_title ?? "A role",
    place: [job?.company_name ?? ext?.external_company, job?.location ?? ext?.external_location]
      .filter(Boolean)
      .join(" · "),
    url: job?.apply_url ?? ext?.external_url ?? null,
  };
}

type Item = {
  key: string;
  title: string;
  place: string;
  url: string | null;
  meta: string;
  note?: string | null;
  badge?: string | null;
};

function JobList<T>({
  rows,
  empty,
  render,
}: {
  rows: T[] | null;
  empty: string;
  render: (r: T) => Item;
}) {
  if (!rows) return <Empty>Loading…</Empty>;
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <ul className={`mt-6 ${list}`}>
      {rows.map((row) => {
        const r = render(row);
        return (
          <li key={r.key} className="flex flex-wrap items-start justify-between gap-4 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{r.title}</span>
                {r.badge && <Badge>{r.badge}</Badge>}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {[r.place, r.meta].filter(Boolean).join(" · ")}
              </div>
              {r.note && <p className="mt-2 max-w-2xl whitespace-pre-line text-sm">{r.note}</p>}
            </div>
            {r.url && (
              <a href={r.url} target="_blank" rel="noopener noreferrer" className={linkButton}>
                Open ↗
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const inputCls =
  "rounded-sm border border-[color:var(--color-hairline)] bg-transparent px-3 py-2 text-sm";

type JobHit = { id: string; title: string; company_name: string | null; location: string | null };

/** Share a Savant listing, or a link to a job on another site. */
function ShareJob({
  talentId,
  talentName,
  onShared,
}: {
  talentId: string;
  talentName: string;
  onShared: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"savant" | "link" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Savant listing search
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<JobHit[] | null>(null);
  // Outside link
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [place, setPlace] = useState("");

  useEffect(() => {
    if (mode !== "savant") return;
    const term = q
      .trim()
      .replace(/[%_,()]/g, " ")
      .trim();
    if (term.length < 2) return setHits(null);
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, company_name, location")
        .eq("status", "active")
        .or(`title.ilike.%${term}%,company_name.ilike.%${term}%`)
        .order("posted_at", { ascending: false, nullsFirst: false })
        .limit(10);
      if (error) return toast.error(error.message);
      setHits(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, mode]);

  function reset() {
    setMode(null);
    setNote("");
    setQ("");
    setHits(null);
    setUrl("");
    setTitle("");
    setCompany("");
    setPlace("");
  }

  async function shareSavant(job: JobHit) {
    setBusy(true);
    const { error } = await supabase.rpc("share_job", {
      _job_id: job.id,
      _talent_ids: [talentId],
      _note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Sent ${job.title} to ${talentName}.`);
    reset();
    await onShared();
  }

  async function shareLink() {
    setBusy(true);
    const { error } = await supabase.rpc("share_external_job", {
      _talent_id: talentId,
      _url: url.trim(),
      _title: title.trim(),
      _company: company.trim() || null,
      _location: place.trim() || null,
      _note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Sent to ${talentName}.`);
    reset();
    await onShared();
  }

  if (!mode) {
    return (
      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={() => setMode("savant")} className={outlineButton}>
          Share a Savant job
        </button>
        <button onClick={() => setMode("link")} className={outlineButton}>
          Share a job link
        </button>
      </div>
    );
  }

  const noteField = (
    <label className="flex flex-col gap-1">
      <span className={label}>Note (optional)</span>
      <input
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why it's a fit, what to highlight"
        className={inputCls}
      />
    </label>
  );

  return (
    <div className="mt-6 max-w-3xl space-y-4 rounded-sm border border-[color:var(--color-hairline)] p-5">
      {mode === "savant" ? (
        <>
          <label className="flex flex-col gap-1">
            <span className={label}>Search Savant jobs</span>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Title or company"
              className={inputCls}
            />
          </label>
          {noteField}
          {hits &&
            (hits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open jobs match.</p>
            ) : (
              <ul className={list}>
                {hits.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0 text-sm">
                      <div className="font-medium">{j.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {[j.company_name, j.location].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <button
                      onClick={() => shareSavant(j)}
                      disabled={busy}
                      className={`shrink-0 ${linkButton}`}
                    >
                      Share →
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className={label}>Link to the listing</span>
            <input
              autoFocus
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              className={inputCls}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className={label}>Job title</span>
              <input
                value={title}
                maxLength={300}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>Company</span>
              <input
                value={company}
                maxLength={200}
                onChange={(e) => setCompany(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>Location</span>
              <input
                value={place}
                maxLength={200}
                onChange={(e) => setPlace(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          {noteField}
          <button
            onClick={shareLink}
            disabled={busy || !url.trim() || !title.trim()}
            className={outlineButton}
          >
            {busy ? "Sending…" : `Send to ${talentName}`}
          </button>
        </>
      )}
      <button onClick={reset} className={`block ${mutedButton}`}>
        Cancel
      </button>
    </div>
  );
}
