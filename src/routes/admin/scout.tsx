import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Badge,
  Empty,
  Field,
  SectionHeading,
  card,
  label,
  linkButton,
  list,
  mutedButton,
  outlineButton,
  primaryButton,
  selectCls,
  timeAgo,
} from "@/components/site/ui";
import { boardUrl } from "@/lib/scout/detect";
import {
  DEFAULT_RATINGS_CONFIG,
  evaluateCompany,
  indexRatings,
  type CompanyRating,
  type RatingSource,
  type RatingsConfig,
} from "@/lib/scout/ratings";
import { NAICS_SECTOR_OPTIONS } from "@/lib/scout/refine";
import { detectCompanyAts, runScoutNow } from "@/lib/scout/scout.functions";
import { ATS_PLATFORMS, type AtsPlatform } from "@/lib/scout/types";

export const Route = createFileRoute("/admin/scout")({
  head: () => ({
    meta: [{ title: "Job Scout" }, { name: "robots", content: "noindex" }],
  }),
  component: JobScout,
});

type Company = {
  id: string;
  name: string;
  careers_url: string | null;
  ats: string | null;
  ats_token: string | null;
  industry: string | null;
  naics_code: string | null;
  enabled: boolean;
  last_scanned_at: string | null;
  last_status: string | null;
  last_error: string | null;
  last_pass_rate: number | null;
  rating_name: string | null;
  rating_override: string | null;
  last_rating: string | null;
};

type Run = {
  id: string;
  trigger: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  companies_scanned: number;
  jobs_found: number;
  jobs_inserted: number;
  jobs_updated: number;
  jobs_rejected: number;
  jobs_flagged: number;
  jobs_closed: number;
  error: string | null;
};

type FlaggedJob = {
  id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  apply_url: string | null;
  ghost_score: number;
  ghost_reasons: string[];
  posted_at: string | null;
};

type Outcomes = Awaited<ReturnType<typeof runScoutNow>>["outcomes"];

const STATUS_TONE: Record<string, "good" | "warn" | "bad" | "muted"> = {
  ok: "good",
  no_ats: "warn",
  failed_audit: "warn",
  failed_rating: "warn",
  http_error: "bad",
  error: "bad",
  succeeded: "good",
  partial: "warn",
  failed: "bad",
  running: "muted",
};

const ATS_LABEL: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
};

function JobScout() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [flagged, setFlagged] = useState<FlaggedJob[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [lastOutcomes, setLastOutcomes] = useState<Outcomes | null>(null);
  const [ratings, setRatings] = useState<CompanyRating[]>([]);
  const [ratingsConfig, setRatingsConfig] = useState<RatingsConfig>(DEFAULT_RATINGS_CONFIG);
  const ratingsIndex = useMemo(() => indexRatings(ratings), [ratings]);

  useEffect(() => {
    // The same lists + cutoffs the scan uses, so the table shows each company's
    // verdict before it's scanned.
    (async () => {
      const rows: CompanyRating[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase
          .from("company_ratings")
          .select("source, company_name, normalized_name, rank, score")
          .range(from, from + 999);
        rows.push(
          ...(data ?? []).map((r) => ({
            ...r,
            source: r.source as RatingSource,
            score: r.score === null ? null : Number(r.score),
          })),
        );
        if (!data || data.length < 1000) break;
      }
      setRatings(rows);
      const { data: st } = await supabase
        .from("scout_settings")
        .select("ratings_enabled, just_capital_max_rank, as_you_sow_min_score, ratings_mode")
        .eq("id", 1)
        .maybeSingle();
      if (st)
        setRatingsConfig({
          enabled: st.ratings_enabled,
          just_capital_max_rank: st.just_capital_max_rank,
          as_you_sow_min_score: Number(st.as_you_sow_min_score),
          mode: st.ratings_mode === "any" ? "any" : "all",
        });
    })();
  }, []);

  async function patchCompany(
    c: Company,
    patch: Partial<Pick<Company, "rating_name" | "rating_override">>,
  ) {
    const { error } = await supabase.from("scout_companies").update(patch).eq("id", c.id);
    if (error) return toast.error(error.message);
    setCompanies((prev) => prev?.map((x) => (x.id === c.id ? { ...x, ...patch } : x)) ?? null);
  }

  function editAlias(c: Company) {
    const next = window.prompt(
      `Name to look up in JUST Capital / As You Sow for ${c.name} (blank = use "${c.name}")`,
      c.rating_name ?? "",
    );
    if (next === null) return;
    patchCompany(c, { rating_name: next.trim() || null });
  }

  async function load() {
    const [{ data: c }, { data: r }, { data: f }] = await Promise.all([
      supabase.from("scout_companies").select("*").order("name"),
      supabase.from("scout_runs").select("*").order("started_at", { ascending: false }).limit(10),
      supabase
        .from("jobs")
        .select(
          "id, title, company_name, location, apply_url, ghost_score, ghost_reasons, posted_at",
        )
        .eq("status", "flagged")
        .order("ghost_score", { ascending: false })
        .limit(100),
    ]);
    setCompanies(c ?? []);
    setRuns(r ?? []);
    setFlagged(f ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function run(companyIds?: string[]) {
    setRunning(companyIds?.[0] ?? "all");
    setLastOutcomes(null);
    try {
      const res = await runScoutNow({ data: { companyIds } });
      setLastOutcomes(res.outcomes);
      const t = res.totals;
      toast.success(
        `Scan ${res.status}: ${t.jobs_inserted} new, ${t.jobs_updated} updated, ${t.jobs_flagged} flagged, ${t.jobs_closed} closed.`,
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setRunning(null);
    }
  }

  async function toggle(c: Company) {
    const { error } = await supabase
      .from("scout_companies")
      .update({ enabled: !c.enabled })
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    setCompanies(
      (prev) => prev?.map((x) => (x.id === c.id ? { ...x, enabled: !c.enabled } : x)) ?? null,
    );
  }

  async function remove(c: Company) {
    if (!window.confirm(`Remove ${c.name}? Its postings stay, but won't be refreshed.`)) return;
    const { error } = await supabase.from("scout_companies").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    setCompanies((prev) => prev?.filter((x) => x.id !== c.id) ?? null);
  }

  async function review(job: FlaggedJob, verdict: "approve" | "close") {
    const patch =
      verdict === "approve" ? { status: "active", ghost_override: true } : { status: "closed" };
    const { error } = await supabase.from("jobs").update(patch).eq("id", job.id);
    if (error) return toast.error(error.message);
    setFlagged((prev) => prev.filter((j) => j.id !== job.id));
    toast.success(verdict === "approve" ? "Approved — it's back in feeds." : "Closed.");
  }

  const enabledCount = companies?.filter((c) => c.enabled).length ?? 0;

  return (
    <section className="space-y-16">
      <div>
        <SectionHeading title="Job Scout">
          <button
            onClick={() => run()}
            disabled={!!running || enabledCount === 0}
            className={primaryButton}
          >
            {running === "all" ? "Scanning…" : `Scan all (${enabledCount})`}
          </button>
        </SectionHeading>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          The scout reads each company's public ATS job board (Greenhouse, Lever, Ashby,
          SmartRecruiters, Workable), validates every posting, refines it (schedule, seniority,
          remote, NAICS), screens ghost jobs, and publishes the rest to the talent feed. Postings
          that disappear from a board are closed automatically. Companies are first checked against
          the{" "}
          <Link to="/admin/ratings" className="text-foreground underline underline-offset-4">
            employer ratings
          </Link>
          ; one that misses a cutoff is skipped.
        </p>
      </div>

      {lastOutcomes && <OutcomeTable outcomes={lastOutcomes} />}

      <AddCompany onAdded={load} />

      <div>
        <SectionHeading title={`Companies${companies ? ` (${companies.length})` : ""}`} />
        {!companies ? (
          <Empty>Loading…</Empty>
        ) : companies.length === 0 ? (
          <Empty>No companies yet — add one above.</Empty>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--color-hairline)] text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  <th className="py-3 font-normal">Company</th>
                  <th className="py-3 font-normal">ATS endpoint</th>
                  <th className="py-3 font-normal">Ratings gate</th>
                  <th className="py-3 font-normal">Last scan</th>
                  <th className="py-3 text-right font-normal">Data quality</th>
                  <th className="py-3 text-right font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b border-[color:var(--color-hairline)] align-top ${c.enabled ? "" : "opacity-50"}`}
                  >
                    <td className="py-4 pr-4">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[c.industry, c.naics_code && `NAICS ${c.naics_code}`]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      {c.ats && c.ats_token ? (
                        <a
                          href={boardUrl(c.ats as AtsPlatform, c.ats_token)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline-offset-4 [@media(hover:hover)]:hover:underline"
                        >
                          {ATS_LABEL[c.ats] ?? c.ats} / {c.ats_token}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Identify on next scan</span>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      <RatingCell
                        verdict={evaluateCompany(c.name, ratingsIndex, ratingsConfig, {
                          alias: c.rating_name,
                          override: c.rating_override as "pass" | "fail" | null,
                        })}
                        company={c}
                        onOverride={(v) => patchCompany(c, { rating_override: v })}
                        onAlias={() => editAlias(c)}
                      />
                    </td>
                    <td className="py-4 pr-4">
                      {c.last_status ? (
                        <Badge tone={STATUS_TONE[c.last_status]}>
                          {c.last_status.replace("_", " ")}
                        </Badge>
                      ) : (
                        <Badge>never</Badge>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {timeAgo(c.last_scanned_at)}
                      </div>
                      {c.last_error && (
                        <div className="mt-1 max-w-xs text-xs text-red-700">{c.last_error}</div>
                      )}
                    </td>
                    <td className="py-4 pr-4 text-right tabular-nums">
                      {c.last_pass_rate === null ? "—" : `${Number(c.last_pass_rate)}%`}
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-4">
                        <button
                          onClick={() => run([c.id])}
                          disabled={!!running}
                          className={linkButton}
                        >
                          {running === c.id ? "…" : "Scan"}
                        </button>
                        <button onClick={() => toggle(c)} className={mutedButton}>
                          {c.enabled ? "Pause" : "Resume"}
                        </button>
                        <button onClick={() => remove(c)} className={mutedButton}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <SectionHeading title={`Ghost job review (${flagged.length})`} />
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Postings the Ghost Job Detector hid from feeds. Approve one and it's never auto-flagged
          again.
        </p>
        {flagged.length === 0 ? (
          <Empty>Nothing waiting for review.</Empty>
        ) : (
          <ul className={`mt-6 ${list}`}>
            {flagged.map((j) => (
              <li key={j.id} className="flex flex-wrap items-start justify-between gap-4 py-5">
                <div className="min-w-0">
                  <div className="font-medium">
                    {j.apply_url ? (
                      <a
                        href={j.apply_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="[@media(hover:hover)]:hover:underline"
                      >
                        {j.title} ↗
                      </a>
                    ) : (
                      j.title
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {j.company_name ?? "—"} · {j.location ?? "—"} · posted {timeAgo(j.posted_at)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="bad">score {j.ghost_score}</Badge>
                    {j.ghost_reasons.map((r) => (
                      <Badge key={r}>{r}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-5">
                  <button onClick={() => review(j, "approve")} className={linkButton}>
                    It's real
                  </button>
                  <button onClick={() => review(j, "close")} className={mutedButton}>
                    Close
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <SectionHeading title="Recent runs" />
        {runs.length === 0 ? (
          <Empty>No runs yet.</Empty>
        ) : (
          <ul className={`mt-6 ${list}`}>
            {runs.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-baseline justify-between gap-4 py-4 text-sm"
              >
                <div className="flex items-baseline gap-3">
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  <span>{new Date(r.started_at).toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">{r.trigger}</span>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {r.companies_scanned} companies · {r.jobs_found} found · {r.jobs_inserted} new ·{" "}
                  {r.jobs_updated} updated · {r.jobs_rejected} rejected · {r.jobs_flagged} flagged ·{" "}
                  {r.jobs_closed} closed
                </div>
                {r.error && <div className="w-full text-xs text-red-700">{r.error}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function RatingCell({
  verdict,
  company,
  onOverride,
  onAlias,
}: {
  verdict: ReturnType<typeof evaluateCompany>;
  company: Company;
  onOverride: (v: "pass" | "fail" | null) => void;
  onAlias: () => void;
}) {
  const tone =
    verdict.verdict === "pass" || verdict.verdict === "override_pass"
      ? "good"
      : verdict.verdict === "fail" || verdict.verdict === "override_fail"
        ? "bad"
        : "muted";
  const label = {
    pass: "passes",
    fail: "gated out",
    unlisted: "not listed",
    override_pass: "forced in",
    override_fail: "forced out",
  }[verdict.verdict];
  return (
    <div className="max-w-xs space-y-1">
      <Badge tone={tone}>{label}</Badge>
      <div className="text-xs text-muted-foreground">
        {verdict.verdict === "unlisted" ? "Normal filters only" : verdict.summary}
      </div>
      {company.rating_name && (
        <div className="text-xs text-muted-foreground">Matched as “{company.rating_name}”</div>
      )}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <select
          value={company.rating_override ?? ""}
          onChange={(e) => onOverride((e.target.value || null) as "pass" | "fail" | null)}
          className="rounded-sm border border-[color:var(--color-hairline)] bg-transparent px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em]"
          aria-label={`Ratings override for ${company.name}`}
        >
          <option value="">Use ratings</option>
          <option value="pass">Always include</option>
          <option value="fail">Always exclude</option>
        </select>
        <button onClick={onAlias} className={mutedButton}>
          Match name
        </button>
      </div>
    </div>
  );
}

function OutcomeTable({ outcomes }: { outcomes: Outcomes }) {
  return (
    <div className={card}>
      <div className={label}>Last scan</div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              <th className="py-2 font-normal">Company</th>
              <th className="py-2 font-normal">Result</th>
              <th className="py-2 text-right font-normal">Found</th>
              <th className="py-2 text-right font-normal">Pass</th>
              <th className="py-2 text-right font-normal">New</th>
              <th className="py-2 text-right font-normal">Flagged</th>
              <th className="py-2 text-right font-normal">Closed</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {outcomes.map((o) => (
              <tr key={o.company} className="border-t border-[color:var(--color-hairline)]">
                <td className="py-2">{o.company}</td>
                <td className="py-2">
                  <Badge tone={STATUS_TONE[o.status]}>{o.status.replace("_", " ")}</Badge>
                  {o.error && (
                    <span className="ml-2 text-xs text-red-700">{o.error.slice(0, 80)}</span>
                  )}
                </td>
                <td className="py-2 text-right">{o.found}</td>
                <td className="py-2 text-right">{Math.round(o.passRate * 100)}%</td>
                <td className="py-2 text-right">{o.inserted}</td>
                <td className="py-2 text-right">{o.flagged}</td>
                <td className="py-2 text-right">{o.closed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Admin input → Company Web Scan → config row. */
function AddCompany({ onAdded }: { onAdded: () => void }) {
  const { userId } = Route.useRouteContext();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [ats, setAts] = useState<string>("");
  const [token, setToken] = useState("");
  const [naics, setNaics] = useState("");
  const [industry, setIndustry] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<Awaited<ReturnType<typeof detectCompanyAts>> | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  async function detect() {
    if (!url.trim()) return toast.error("Paste a careers page or ATS link first.");
    setDetecting(true);
    setDetected(null);
    try {
      const res = await detectCompanyAts({ data: { url: url.trim() } });
      setDetected(res);
      if (res.hit) {
        setAts(res.hit.ats);
        setToken(res.hit.token);
        if (!name)
          setName(res.hit.token.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()));
      } else
        toast.error(
          "No supported ATS found — pick it manually, or the company may use an unsupported one.",
        );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setDetecting(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error("Give the company a name.");
    if (!url.trim() && !(ats && token.trim()))
      return toast.error("Add a careers URL or choose the ATS and board token.");
    setSaving(true);
    const { error } = await supabase.from("scout_companies").insert({
      name: name.trim(),
      careers_url: url.trim() || null,
      ats: ats || null,
      ats_token: ats ? token.trim() || null : null,
      industry: industry.trim() || null,
      naics_code: naics || null,
      added_by: userId,
    });
    setSaving(false);
    if (error)
      return toast.error(
        error.code === "23505" ? "That ATS board is already in the list." : error.message,
      );
    toast.success(`${name.trim()} added. It'll be picked up by the next scan.`);
    setUrl("");
    setName("");
    setAts("");
    setToken("");
    setNaics("");
    setIndustry("");
    setDetected(null);
    onAdded();
  }

  return (
    <div className={card}>
      <div className="text-lg font-medium">Add a company</div>
      <form onSubmit={save} className="mt-6 space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[16rem] flex-1">
            <Field
              label="Careers page or ATS link"
              value={url}
              onChange={setUrl}
              placeholder="https://acme.com/careers  or  jobs.lever.co/acme"
            />
          </div>
          <button type="button" onClick={detect} disabled={detecting} className={outlineButton}>
            {detecting ? "Scanning…" : "Identify ATS"}
          </button>
        </div>
        {detected && (
          <p className="text-xs text-muted-foreground">
            {detected.hit ? (
              <>
                Found <strong className="text-foreground">{ATS_LABEL[detected.hit.ats]}</strong>{" "}
                board{" "}
                <a
                  href={detected.hit.board}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  {detected.hit.token}
                </a>
                {detected.alternatives.length > 0 &&
                  ` (also saw: ${detected.alternatives.map((a) => `${a.ats}/${a.token}`).join(", ")})`}
              </>
            ) : (
              <>Checked {detected.checked.length} page(s); no supported ATS found.</>
            )}
          </p>
        )}
        <div className="grid gap-6 md:grid-cols-3">
          <Field label="Company name" value={name} onChange={setName} />
          <label className="block">
            <span className={label}>ATS</span>
            <select
              value={ats}
              onChange={(e) => setAts(e.target.value)}
              className={`mt-2 block w-full ${selectCls}`}
            >
              <option value="">Auto-detect on scan</option>
              {ATS_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {ATS_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <Field label="Board token" value={token} onChange={setToken} placeholder="acme" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <label className="block">
            <span className={label}>NAICS sector</span>
            <select
              value={naics}
              onChange={(e) => {
                setNaics(e.target.value);
                const o = NAICS_SECTOR_OPTIONS.find((x) => x.code === e.target.value);
                if (o && !industry) setIndustry(o.label);
              }}
              className={`mt-2 block w-full ${selectCls}`}
            >
              <option value="">Infer from postings</option>
              {NAICS_SECTOR_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.code} — {o.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Industry label" value={industry} onChange={setIndustry} />
        </div>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving ? "…" : "Add company"}
        </button>
      </form>
    </div>
  );
}
