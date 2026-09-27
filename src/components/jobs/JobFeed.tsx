import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { getAutofillReadiness } from "@/lib/autofill/autofill.functions";
import { detectJob } from "@/lib/autofill/mapper";
import {
  applyFilters,
  effectiveTrack,
  EMPTY_FILTERS,
  rankJobs,
  type FeedFilters,
  type RankablePreferences,
  type TrackFilter,
} from "@/lib/scout/rank";
import { NAICS_SECTOR_OPTIONS } from "@/lib/scout/refine";
import { JOB_TRACK_BLURBS, JOB_TRACK_LABELS, JOB_TRACKS } from "@/lib/scout/track";
import { EMPLOYMENT_TYPE_LABELS, EMPLOYMENT_TYPES } from "@/lib/scout/types";
import {
  Badge,
  ChipGroup,
  label,
  linkButton,
  list,
  mutedButton,
  selectCls,
  timeAgo,
} from "@/components/site/ui";

export type FeedJob = {
  id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  type: string | null;
  employment_type: string | null;
  description: string | null;
  apply_url: string | null;
  source: string;
  remote: boolean;
  industry: string | null;
  naics_code: string | null;
  posted_at: string | null;
  created_at: string;
  ghost_score: number;
  employer_badges: string[];
  track: string;
  track_override: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_unit: string | null;
  organizations: { name: string } | null;
};

const JOB_COLUMNS =
  "id, title, company_name, location, type, employment_type, description, apply_url, source, remote, industry, naics_code, posted_at, created_at, ghost_score, employer_badges, track, track_override, pay_min, pay_max, pay_unit, organizations (name)";

const DATE_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "1", label: "Past 24 hours" },
  { value: "3", label: "Past 3 days" },
  { value: "7", label: "Past week" },
  { value: "30", label: "Past month" },
];

const PAGE = 25;
const GUEST_PREVIEW = 6;

async function loadActiveJobs(limit: number): Promise<FeedJob[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("status", "active")
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as FeedJob[]) ?? [];
}

const companyOf = (j: FeedJob) => j.company_name ?? j.organizations?.name ?? "Savant client";

const PAY_UNIT_SHORT: Record<string, string> = {
  hour: "/hr",
  day: "/day",
  week: "/wk",
  month: "/mo",
  year: "/yr",
};

/** "$18–$22/hr", "$60K–$80K/yr" */
export function formatPay(j: Pick<FeedJob, "pay_min" | "pay_max" | "pay_unit">): string | null {
  const lo = j.pay_min === null ? null : Number(j.pay_min);
  const hi = j.pay_max === null ? null : Number(j.pay_max);
  if (lo === null && hi === null) return null;
  const money = (n: number) =>
    n >= 10_000 ? `${Math.round(n / 1000)}K` : `${Number.isInteger(n) ? n : n.toFixed(2)}`;
  const range =
    lo !== null && hi !== null && lo !== hi ? `${money(lo)}–${money(hi)}` : money((hi ?? lo)!);
  return `${range}${PAY_UNIT_SHORT[j.pay_unit ?? ""] ?? ""}`;
}

/**
 * The job feed. `talent` mode is the full ranked feed with refine filters,
 * bookmarks and apply; `guest` mode is the public preview on /jobs.
 */
export function JobFeed({
  mode,
  userId,
  initialTrack,
}: {
  mode: "talent" | "guest";
  userId?: string;
  /** Opens on this feed (from ?track=); otherwise the talent's saved choice. */
  initialTrack?: TrackFilter;
}) {
  const { auth } = useAuth();
  // Signed-in recruiters/admins browsing the public preview aren't prompted to sign up.
  const signedIn = !!auth;
  const [jobs, setJobs] = useState<FeedJob[] | null>(null);
  const [prefs, setPrefs] = useState<RankablePreferences | null>(null);
  const [filters, setFilters] = useState<FeedFilters>({
    ...EMPTY_FILTERS,
    track: initialTrack ?? "all",
  });
  const [applied, setApplied] = useState<Map<string, string>>(new Map());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    loadActiveJobs(mode === "talent" ? 1000 : 200)
      .then(setJobs)
      .catch((e) => {
        console.error(e);
        setJobs([]);
      });
  }, [mode]);

  useEffect(() => {
    if (mode !== "talent" || !userId) return;
    (async () => {
      const [{ data: p }, { data: apps }, { data: savedRows }] = await Promise.all([
        supabase.from("talent_preferences").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("job_applications").select("job_id, status").eq("applicant_id", userId),
        supabase.from("saved_jobs").select("job_id").eq("user_id", userId),
      ]);
      if (p) {
        setPrefs(p);
        setFilters((f) => ({
          ...f,
          postedWithinDays: p.posted_within_days || null,
          track: initialTrack ?? (p.job_track as TrackFilter),
        }));
      }
      setApplied(new Map((apps ?? []).map((a) => [a.job_id, a.status])));
      setSaved(new Set((savedRows ?? []).map((r) => r.job_id)));
    })();
    // initialTrack only seeds the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, userId]);

  const ranked = useMemo(() => {
    if (!jobs) return null;
    const filtered =
      mode === "talent"
        ? applyFilters(jobs, filters)
        : applyFilters(jobs, { ...EMPTY_FILTERS, track: filters.track });
    return rankJobs(filtered, prefs);
  }, [jobs, filters, prefs, mode]);

  async function toggleSave(jobId: string) {
    if (!userId) return;
    if (saved.has(jobId)) {
      const { error } = await supabase
        .from("saved_jobs")
        .delete()
        .eq("job_id", jobId)
        .eq("user_id", userId);
      if (error) return toast.error(error.message);
      setSaved((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    } else {
      const { error } = await supabase
        .from("saved_jobs")
        .insert({ job_id: jobId, user_id: userId });
      if (error) return toast.error(error.message);
      setSaved((prev) => new Set(prev).add(jobId));
      toast.success("Bookmarked.");
    }
  }

  async function apply(job: FeedJob) {
    if (!userId) return;
    // Scouted jobs are applied to on the company's own ATS; we record that the
    // talent started, and the Savant Apply extension upgrades it on submit.
    const external = !!job.apply_url && job.source !== "manual";
    if (external) window.open(job.apply_url!, "_blank", "noopener,noreferrer");
    const status = external ? "started" : "submitted";
    const { error } = await supabase
      .from("job_applications")
      .insert({ job_id: job.id, applicant_id: userId, status });
    if (error && error.code !== "23505") return toast.error(error.message);
    setApplied((prev) => new Map(prev).set(job.id, status));
    toast.success(
      external
        ? "Opened the company's application. We've added it to your dashboard."
        : "Application submitted.",
    );
  }

  if (!ranked) return <p className="mt-10 text-sm text-muted-foreground">Loading roles…</p>;

  const visible = mode === "guest" ? ranked.slice(0, GUEST_PREVIEW) : ranked.slice(0, shown);

  const trackCounts = {
    all: jobs?.length ?? 0,
    hourly: jobs?.filter((j) => effectiveTrack(j) === "hourly").length ?? 0,
    professional: jobs?.filter((j) => effectiveTrack(j) === "professional").length ?? 0,
  };

  return (
    <div>
      <TrackTabs
        value={filters.track}
        counts={trackCounts}
        onChange={(track) => (setFilters((f) => ({ ...f, track })), setShown(PAGE))}
      />
      {mode === "talent" && (
        <Filters
          filters={filters}
          onChange={(f) => (setFilters(f), setShown(PAGE))}
          count={ranked.length}
          hasPrefs={!!prefs}
        />
      )}

      {ranked.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          {mode === "talent"
            ? "No roles match these filters. Try widening them."
            : "New roles are on the way — check back soon."}
        </p>
      ) : (
        <ul className={`mt-8 ${list}`}>
          {visible.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              mode={mode}
              signedIn={signedIn}
              open={openId === job.id}
              onToggle={() => setOpenId(openId === job.id ? null : job.id)}
              appliedStatus={applied.get(job.id)}
              isSaved={saved.has(job.id)}
              onSave={() => toggleSave(job.id)}
              onApply={() => apply(job)}
            />
          ))}
        </ul>
      )}

      {mode === "talent" && ranked.length > shown && (
        <div className="mt-8 text-center">
          <button onClick={() => setShown((n) => n + PAGE)} className={mutedButton}>
            Show more ({ranked.length - shown} left)
          </button>
        </div>
      )}

      {mode === "guest" && !signedIn && (
        <div className="mt-12 flex flex-wrap items-center justify-between gap-6 border border-[color:var(--color-hairline)] p-8">
          <div>
            <div className="text-xl font-medium">
              {ranked.length > GUEST_PREVIEW
                ? `${ranked.length - GUEST_PREVIEW}+ more open roles`
                : "Get matched as roles open"}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a free talent account for your personalised feed, filters, bookmarks, and
              one-click applications.
            </p>
          </div>
          <Link
            to="/auth"
            search={{ mode: "signup" } as never}
            className="rounded-sm bg-foreground px-6 py-3 text-[12px] font-medium uppercase tracking-[0.2em] text-background"
          >
            Sign up
          </Link>
        </div>
      )}
    </div>
  );
}

/** The two feeds: temp & hourly (low barrier to entry) and professional. */
function TrackTabs({
  value,
  counts,
  onChange,
}: {
  value: TrackFilter;
  counts: Record<TrackFilter, number>;
  onChange: (t: TrackFilter) => void;
}) {
  const tabs: { value: TrackFilter; label: string; blurb: string }[] = [
    { value: "all", label: "All roles", blurb: "Every open role, both feeds together." },
    ...JOB_TRACKS.map((t) => ({
      value: t,
      label: JOB_TRACK_LABELS[t],
      blurb: JOB_TRACK_BLURBS[t],
    })),
  ];
  return (
    <div className="mb-8">
      <div
        role="tablist"
        aria-label="Job feed"
        className="grid grid-cols-3 border border-[color:var(--color-hairline)]"
      >
        {tabs.map((t) => {
          const on = value === t.value;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t.value)}
              className={`px-3 py-4 text-left transition-colors sm:px-5 ${
                on
                  ? "bg-foreground text-background"
                  : "text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
              }`}
            >
              <div className="text-[11px] font-medium uppercase tracking-[0.18em]">{t.label}</div>
              <div className={`mt-1 text-xs ${on ? "opacity-80" : ""}`}>{counts[t.value]} open</div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {tabs.find((t) => t.value === value)?.blurb}
      </p>
    </div>
  );
}

function Filters({
  filters,
  onChange,
  count,
  hasPrefs,
}: {
  filters: FeedFilters;
  onChange: (f: FeedFilters) => void;
  count: number;
  hasPrefs: boolean;
}) {
  const set = <K extends keyof FeedFilters>(k: K, v: FeedFilters[K]) =>
    onChange({ ...filters, [k]: v });
  const input =
    "block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-2 text-base outline-none focus:border-foreground";
  return (
    <div className="space-y-5 border-b border-[color:var(--color-hairline)] pb-8">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className={label}>Position or company</span>
          <input
            className={input}
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="e.g. Forklift, nurse, Acme"
          />
        </label>
        <label className="block">
          <span className={label}>Location</span>
          <input
            className={input}
            value={filters.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="City, state, or “remote”"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-5">
        <label className="block">
          <span className={label}>Industry</span>
          <select
            value={filters.naics}
            onChange={(e) => set("naics", e.target.value)}
            className={`mt-2 block ${selectCls}`}
          >
            <option value="">All industries</option>
            {NAICS_SECTOR_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label} ({o.code})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Date posted</span>
          <select
            value={filters.postedWithinDays === null ? "" : String(filters.postedWithinDays)}
            onChange={(e) =>
              set("postedWithinDays", e.target.value ? Number(e.target.value) : null)
            }
            className={`mt-2 block ${selectCls}`}
          >
            {DATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            {filters.postedWithinDays !== null &&
              !DATE_OPTIONS.some((o) => o.value === String(filters.postedWithinDays)) && (
                <option value={String(filters.postedWithinDays)}>
                  Past {filters.postedWithinDays} days
                </option>
              )}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            className="accent-foreground"
            checked={filters.remoteOnly}
            onChange={(e) => set("remoteOnly", e.target.checked)}
          />
          Remote only
        </label>
      </div>
      <div>
        <span className={label}>Schedule</span>
        <div className="mt-2">
          <ChipGroup
            options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: EMPLOYMENT_TYPE_LABELS[t] }))}
            value={filters.employmentTypes as (typeof EMPLOYMENT_TYPES)[number][]}
            onChange={(v) => set("employmentTypes", v)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>
          {count} role{count === 1 ? "" : "s"} ·{" "}
          {hasPrefs ? "ranked by your preferences" : "newest first"}
          {!hasPrefs && (
            <>
              {" "}
              ·{" "}
              <Link
                to="/talent/preferences"
                className="text-foreground underline underline-offset-4"
              >
                set preferences
              </Link>{" "}
              to rank by fit
            </>
          )}
        </span>
        <button
          onClick={() => onChange({ ...EMPTY_FILTERS, track: filters.track })}
          className={mutedButton}
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}

function JobRow({
  job,
  mode,
  signedIn,
  open,
  onToggle,
  appliedStatus,
  isSaved,
  onSave,
  onApply,
}: {
  job: FeedJob & { match: number; matchReasons: string[] };
  mode: "talent" | "guest";
  signedIn: boolean;
  open: boolean;
  onToggle: () => void;
  appliedStatus?: string;
  isSaved: boolean;
  onSave: () => void;
  onApply: () => void;
}) {
  const external = !!job.apply_url && job.source !== "manual";
  const meta = [
    job.location ?? (job.remote ? null : "Location not listed"),
    job.remote ? "Remote" : null,
    job.type,
    formatPay(job),
    `Posted ${timeAgo(job.posted_at ?? job.created_at)}`,
  ].filter(Boolean);

  return (
    <li className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <button
          onClick={onToggle}
          className="min-w-0 flex-1 basis-full text-left sm:basis-0"
          aria-expanded={open}
        >
          <div className="text-xl font-medium md:text-2xl">{job.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            {companyOf(job)}
            {job.employer_badges?.map((b) => (
              <Badge key={b} tone="good">
                {b}
              </Badge>
            ))}
            <Badge>{JOB_TRACK_LABELS[effectiveTrack(job)]}</Badge>
          </div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {meta.join(" · ")}
          </div>
          {mode === "talent" && job.matchReasons.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {job.matchReasons
                .filter((r) => r !== "Highly rated employer" || !job.employer_badges?.length)
                .map((r) => (
                  <Badge key={r} tone="good">
                    {r}
                  </Badge>
                ))}
            </div>
          )}
        </button>
        <div className="flex items-center gap-5">
          {mode === "talent" && (
            <button onClick={onSave} className={mutedButton} aria-pressed={isSaved}>
              {isSaved ? "Bookmarked" : "Bookmark"}
            </button>
          )}
          {mode === "guest" ? (
            signedIn ? null : (
              <Link
                to="/auth"
                search={{ mode: "signup", next: "/talent/jobs" } as never}
                className={mutedButton}
              >
                Sign up to apply
              </Link>
            )
          ) : appliedStatus ? (
            <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {appliedStatus === "started" ? "Started" : "Applied"}
            </span>
          ) : (
            <button onClick={onApply} className={linkButton}>
              {external ? "Apply on company site ↗" : "Apply →"}
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-5 space-y-4">
          {job.description ? (
            <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {job.description.length > 1800
                ? `${job.description.slice(0, 1800)}…`
                : job.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Full description is on the company's site.
            </p>
          )}
          {mode === "talent" && external && <Readiness url={job.apply_url!} />}
          {external && (
            <a
              href={job.apply_url!}
              target="_blank"
              rel="noopener noreferrer"
              className={mutedButton}
            >
              View original posting ↗
            </a>
          )}
        </div>
      )}
    </li>
  );
}

/** Autofill readiness: how much of this application Savant can fill for you. */
function Readiness({ url }: { url: string }) {
  const [state, setState] = useState<
    Awaited<ReturnType<typeof getAutofillReadiness>> | "loading" | null
  >(null);
  if (detectJob(url)?.ats !== "greenhouse") return null;

  async function check() {
    setState("loading");
    try {
      setState(await getAutofillReadiness({ data: { jobUrl: url } }));
    } catch (e) {
      setState(null);
      toast.error(e instanceof Error ? e.message : "Couldn't check this application");
    }
  }

  if (state === null)
    return (
      <button onClick={check} className={mutedButton}>
        Check autofill readiness
      </button>
    );
  if (state === "loading")
    return <p className="text-xs text-muted-foreground">Reading the application form…</p>;
  if (!state.supported) return null;
  return (
    <div className="max-w-xl rounded-sm border border-[color:var(--color-hairline)] p-4 text-sm">
      Your profile can answer <strong>{state.answerable}</strong> of{" "}
      <strong>{state.required}</strong> required questions.
      {state.missing.length > 0 && (
        <>
          <div className="mt-2 text-xs text-muted-foreground">
            Still needed: {state.missing.slice(0, 6).join(" · ")}
          </div>
          <Link
            to="/talent/profile"
            className="mt-2 inline-block text-xs underline underline-offset-4"
          >
            Complete your profile
          </Link>
        </>
      )}
    </div>
  );
}
