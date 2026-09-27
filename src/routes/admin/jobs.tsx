import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge, ChipGroup, list, mutedButton, timeAgo } from "@/components/site/ui";
import { effectiveTrack } from "@/lib/scout/rank";
import { JOB_TRACK_LABELS, JOB_TRACKS, type JobTrack } from "@/lib/scout/track";

export const Route = createFileRoute("/admin/jobs")({
  head: () => ({
    meta: [{ title: "Jobs" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminJobs,
});

type JobRow = {
  id: string;
  title: string;
  location: string | null;
  company_name: string | null;
  source: string;
  status: string;
  ghost_score: number;
  apply_url: string | null;
  posted_at: string | null;
  created_at: string;
  track: string;
  track_override: string | null;
  track_reasons: string[];
};

type Status = "active" | "flagged" | "closed";
const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "active", label: "Live" },
  { value: "flagged", label: "Flagged" },
  { value: "closed", label: "Closed" },
];
type Origin = "manual" | "scouted";
const ORIGIN_OPTIONS: { value: Origin; label: string }[] = [
  { value: "manual", label: "Savant-posted" },
  { value: "scouted", label: "Scouted" },
];

const TRACK_OPTIONS = JOB_TRACKS.map((t) => ({ value: t, label: JOB_TRACK_LABELS[t] }));

function AdminJobs() {
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [status, setStatus] = useState<Status[]>(["active"]);
  const [origin, setOrigin] = useState<Origin[]>([]);
  const [tracks, setTracks] = useState<JobTrack[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    setJobs(null);
    let query = supabase
      .from("jobs")
      .select(
        "id, title, location, company_name, source, status, ghost_score, apply_url, posted_at, created_at, track, track_override, track_reasons",
      )
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(300);
    if (status.length) query = query.in("status", status);
    if (origin.length === 1)
      query = origin[0] === "manual" ? query.eq("source", "manual") : query.neq("source", "manual");
    // Feed filter: the override wins over the classifier's track.
    if (tracks.length === 1)
      query = query.or(
        `track_override.eq.${tracks[0]},and(track_override.is.null,track.eq.${tracks[0]})`,
      );
    if (q.trim()) query = query.ilike("title", `%${q.trim().replace(/[%_]/g, "")}%`);
    const t = setTimeout(() => query.then(({ data }) => setJobs((data as JobRow[]) ?? [])), 250);
    return () => clearTimeout(t);
  }, [status, origin, tracks, q]);

  /** Move a posting to the other feed; moving it back to the classifier's choice clears the override. */
  async function moveTrack(j: JobRow) {
    const next: JobTrack = effectiveTrack(j) === "hourly" ? "professional" : "hourly";
    const track_override = next === j.track ? null : next;
    const { error } = await supabase.from("jobs").update({ track_override }).eq("id", j.id);
    if (error) return toast.error(error.message);
    setJobs((prev) => prev?.map((x) => (x.id === j.id ? { ...x, track_override } : x)) ?? null);
    toast.success(`Moved to the ${JOB_TRACK_LABELS[next]} feed.`);
  }

  async function setJobStatus(id: string, next: Status) {
    const patch = next === "active" ? { status: next, ghost_override: true } : { status: next };
    const { error } = await supabase.from("jobs").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setJobs((prev) => prev?.map((j) => (j.id === id ? { ...j, status: next } : j)) ?? null);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this posting permanently? Applications to it are deleted too."))
      return;
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setJobs((prev) => prev?.filter((j) => j.id !== id) ?? null);
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Job postings</h2>
      <div className="mt-6 flex flex-wrap items-center gap-6">
        <ChipGroup options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        <ChipGroup options={ORIGIN_OPTIONS} value={origin} onChange={setOrigin} />
        <ChipGroup options={TRACK_OPTIONS} value={tracks} onChange={setTracks} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search titles"
          className="min-w-[12rem] flex-1 border-b border-[color:var(--color-hairline)] bg-transparent py-2 text-sm outline-none focus:border-foreground"
        />
      </div>
      {!jobs ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : jobs.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No postings match.</p>
      ) : (
        <ul className={`mt-8 ${list}`}>
          {jobs.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <div>
                  {j.apply_url ? (
                    <a
                      href={j.apply_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="[@media(hover:hover)]:hover:underline"
                    >
                      {j.title}
                    </a>
                  ) : (
                    j.title
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {j.company_name ?? "—"} · {j.location ?? "—"} ·{" "}
                    {timeAgo(j.posted_at ?? j.created_at)}
                  </span>
                  <Badge>{j.source}</Badge>
                  <span
                    title={
                      j.track_override
                        ? "Moved by hand"
                        : j.track_reasons.join(" · ") || "Classified by the scout"
                    }
                  >
                    <Badge>
                      {JOB_TRACK_LABELS[effectiveTrack(j)]}
                      {j.track_override ? " (set by hand)" : ""}
                    </Badge>
                  </span>
                  <Badge
                    tone={
                      j.status === "active" ? "good" : j.status === "flagged" ? "warn" : "muted"
                    }
                  >
                    {j.status}
                  </Badge>
                  {j.ghost_score > 0 && (
                    <Badge tone={j.ghost_score >= 50 ? "bad" : "muted"}>
                      ghost {j.ghost_score}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => moveTrack(j)} className={mutedButton}>
                  Move to {effectiveTrack(j) === "hourly" ? "Professional" : "Temp & hourly"}
                </button>
                {j.status !== "active" && (
                  <button onClick={() => setJobStatus(j.id, "active")} className={mutedButton}>
                    Publish
                  </button>
                )}
                {j.status !== "closed" && (
                  <button onClick={() => setJobStatus(j.id, "closed")} className={mutedButton}>
                    Close
                  </button>
                )}
                <button onClick={() => remove(j.id)} className={mutedButton}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
