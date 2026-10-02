import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Badge,
  ChipGroup,
  Field,
  SectionHeading,
  card,
  label,
  mutedButton,
  primaryButton,
} from "@/components/site/ui";
import { getScoutEnvStatus } from "@/lib/scout/scout.functions";
import { BOARD_SOURCES, type BoardSource } from "@/lib/scout/types";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [{ title: "Settings" }, { name: "robots", content: "noindex" }],
  }),
  component: Settings,
});

const BOARD_LABEL: Record<BoardSource, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  google: "Google Jobs",
  glassdoor: "Glassdoor",
  zip_recruiter: "ZipRecruiter",
};

type Query = { search_term: string; location?: string };

function Settings() {
  const [env, setEnv] = useState<{ jobspy: boolean; cron: boolean; anthropic: boolean } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [boards, setBoards] = useState<BoardSource[]>([]);
  const [queries, setQueries] = useState<Query[]>([]);
  const [ghost, setGhost] = useState("50");
  const [audit, setAudit] = useState("80");
  const [perPosition, setPerPosition] = useState("5");
  const [maxAge, setMaxAge] = useState("21");
  // False until the database has these columns (migration 20260928000005).
  const [hasIngestRules, setHasIngestRules] = useState(false);
  const [term, setTerm] = useState("");
  const [where, setWhere] = useState("");

  useEffect(() => {
    getScoutEnvStatus()
      .then(setEnv)
      .catch(() => setEnv(null));
    supabase
      .from("scout_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBoards(data.enabled_boards as BoardSource[]);
          setQueries(Array.isArray(data.board_queries) ? (data.board_queries as Query[]) : []);
          setGhost(String(data.ghost_threshold));
          setAudit(String(Math.round(Number(data.audit_threshold) * 100)));
          if (data.max_per_position !== undefined) {
            setHasIngestRules(true);
            setPerPosition(String(data.max_per_position));
            setMaxAge(String(data.max_age_days));
          }
        }
        setLoading(false);
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const g = Number(ghost);
    const a = Number(audit);
    if (!Number.isInteger(g) || g < 1 || g > 100)
      return toast.error("Ghost threshold must be 1–100.");
    if (!Number.isFinite(a) || a < 0 || a > 100)
      return toast.error("Audit pass rate must be 0–100%.");
    const cap = Number(perPosition);
    const age = Number(maxAge);
    if (hasIngestRules && (!Number.isInteger(cap) || cap < 1))
      return toast.error("Postings per position type must be 1 or more.");
    if (hasIngestRules && (!Number.isInteger(age) || age < 1))
      return toast.error("Maximum age must be 1 day or more.");
    setSaving(true);
    const { error } = await supabase
      .from("scout_settings")
      .update({
        enabled_boards: boards,
        board_queries: queries,
        ghost_threshold: g,
        audit_threshold: a / 100,
        ...(hasIngestRules ? { max_per_position: cap, max_age_days: age } : {}),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved. They apply from the next scan.");
  }

  function addQuery() {
    if (!term.trim()) return;
    setQueries((q) => [
      ...q,
      { search_term: term.trim(), ...(where.trim() ? { location: where.trim() } : {}) },
    ]);
    setTerm("");
    setWhere("");
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <form onSubmit={save} className="space-y-16">
      <section>
        <SectionHeading title="Integrations" />
        <p className="mt-2 text-sm text-muted-foreground">
          Configured with server environment variables — see docs/job-scout.md.
        </p>
        <ul className="mt-6 space-y-3 text-sm">
          <EnvRow
            on={env?.cron}
            name="Scheduled scans"
            hint="SCOUT_CRON_SECRET — lets pg_cron (or any scheduler) call /api/scout/run."
          />
          <EnvRow
            on={env?.jobspy}
            name="Job-board scraper (JobSpy)"
            hint="JOBSPY_URL — the services/jobspy container."
          />
          <EnvRow
            on={env?.anthropic}
            name="Autofill answer drafting"
            hint="ANTHROPIC_API_KEY — drafts open-ended answers from the talent's resume."
          />
        </ul>
      </section>

      {hasIngestRules && (
        <section>
          <SectionHeading title="What gets ingested" />
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            U.S. postings only. Per employer, the scout keeps this many postings of each position
            type (software engineering, accounting, admin…), New York, Portland–Eugene and
            California first, then newest. Staffing agencies aren't capped.
          </p>
          <div className="mt-6 grid max-w-xl gap-6 sm:grid-cols-2">
            <Field
              label="Postings per position type"
              type="number"
              value={perPosition}
              onChange={setPerPosition}
              hint="Per employer. Default 5."
            />
            <Field
              label="Maximum age (days)"
              type="number"
              value={maxAge}
              onChange={setMaxAge}
              hint="Older postings aren't ingested. Default 21."
            />
          </div>
        </section>
      )}

      <section>
        <SectionHeading title="Ghost Job Detector & auditor" />
        <div className="mt-6 grid max-w-xl gap-6 sm:grid-cols-2">
          <Field
            label="Flag at ghost score ≥"
            type="number"
            value={ghost}
            onChange={setGhost}
            hint="0–100. Default 50."
          />
          <Field
            label="Min. audit pass rate (%)"
            type="number"
            value={audit}
            onChange={setAudit}
            hint="A board below this is skipped. Default 80."
          />
        </div>
      </section>

      <section>
        <SectionHeading title="Job boards" />
        <div className={`mt-6 ${card} max-w-3xl`}>
          <p className="text-sm">
            <Badge tone="warn">Read first</Badge> LinkedIn, Indeed, Glassdoor, ZipRecruiter and
            Google prohibit automated scraping in their terms of use and actively block it. Enabling
            these runs the JobSpy service against them; that's a legal and account risk Savant takes
            on. Company ATS boards (Job Scout) are public, documented APIs and carry no such risk.
          </p>
          {!env?.jobspy && (
            <p className="mt-3 text-xs text-muted-foreground">
              JOBSPY_URL isn't set, so these have no effect yet.
            </p>
          )}
          <div className="mt-6">
            <span className={label}>Enabled boards</span>
            <div className="mt-3">
              <ChipGroup
                options={BOARD_SOURCES.map((b) => ({ value: b, label: BOARD_LABEL[b] }))}
                value={boards}
                onChange={setBoards}
              />
            </div>
          </div>
          <div className="mt-8">
            <span className={label}>Searches</span>
            {queries.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No searches yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {queries.map((q, i) => (
                  <li
                    key={`${q.search_term}-${i}`}
                    className="flex items-center justify-between gap-4"
                  >
                    <span>
                      “{q.search_term}”{q.location ? ` in ${q.location}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQueries((prev) => prev.filter((_, j) => j !== i))}
                      className={mutedButton}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div className="min-w-[12rem] flex-1">
                <Field
                  label="Search term"
                  value={term}
                  onChange={setTerm}
                  placeholder="warehouse associate"
                />
              </div>
              <div className="min-w-[12rem] flex-1">
                <Field
                  label="Location"
                  value={where}
                  onChange={setWhere}
                  placeholder="Atlanta, GA"
                />
              </div>
              <button type="button" onClick={addQuery} className={mutedButton}>
                Add search
              </button>
            </div>
          </div>
        </div>
      </section>

      <button type="submit" disabled={saving} className={primaryButton}>
        {saving ? "…" : "Save settings"}
      </button>
    </form>
  );
}

function EnvRow({ on, name, hint }: { on: boolean | undefined; name: string; hint: string }) {
  return (
    <li className="flex flex-wrap items-baseline gap-3">
      <Badge tone={on === undefined ? "muted" : on ? "good" : "muted"}>
        {on === undefined ? "…" : on ? "configured" : "off"}
      </Badge>
      <span>{name}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </li>
  );
}
