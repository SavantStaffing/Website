import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Badge,
  Empty,
  Field,
  SectionHeading,
  Toggle,
  card,
  label,
  outlineButton,
  primaryButton,
  selectCls,
} from "@/components/site/ui";
import {
  DEFAULT_RATINGS_CONFIG,
  RATING_SOURCE_LABEL,
  evaluateCompany,
  indexRatings,
  ratingsFromCsv,
  type CompanyRating,
  type RatingSource,
  type RatingsConfig,
} from "@/lib/scout/ratings";

export const Route = createFileRoute("/admin/ratings")({
  head: () => ({
    meta: [{ title: "Employer Ratings" }, { name: "robots", content: "noindex" }],
  }),
  component: Ratings,
});

/**
 * The Job Scout's "Passing Score from Auditor": JUST Capital + As You Sow
 * lists, their cutoffs, and CSV import to refresh them.
 */
function Ratings() {
  const [list, setList] = useState<CompanyRating[] | null>(null);
  const [config, setConfig] = useState<RatingsConfig>(DEFAULT_RATINGS_CONFIG);
  const [saving, setSaving] = useState(false);
  const [lookup, setLookup] = useState("");

  async function load() {
    const rows: CompanyRating[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from("company_ratings")
        .select("source, company_name, normalized_name, rank, score")
        .order("company_name")
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
    setList(rows);
  }

  useEffect(() => {
    load();
    supabase
      .from("scout_settings")
      .select("ratings_enabled, just_capital_max_rank, as_you_sow_min_score, ratings_mode")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data)
          setConfig({
            enabled: data.ratings_enabled,
            just_capital_max_rank: data.just_capital_max_rank,
            as_you_sow_min_score: Number(data.as_you_sow_min_score),
            mode: data.ratings_mode === "any" ? "any" : "all",
          });
      });
  }, []);

  const index = useMemo(() => indexRatings(list ?? []), [list]);

  const stats = useMemo(() => {
    const names = [...index.keys()];
    const verdicts = names.map((n) => evaluateCompany(n, index, config).verdict);
    const bySource = (s: RatingSource) => (list ?? []).filter((r) => r.source === s);
    const just = bySource("just_capital");
    const ays = bySource("as_you_sow");
    return {
      companies: names.length,
      pass: verdicts.filter((v) => v === "pass").length,
      fail: verdicts.filter((v) => v === "fail").length,
      just: {
        total: just.length,
        pass: just.filter((r) => r.rank! <= config.just_capital_max_rank).length,
      },
      ays: {
        total: ays.length,
        pass: ays.filter((r) => r.score! >= config.as_you_sow_min_score).length,
      },
    };
  }, [index, list, config]);

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!(config.just_capital_max_rank > 0))
      return toast.error("JUST Capital cutoff must be a rank above 0.");
    if (!(config.as_you_sow_min_score >= 0 && config.as_you_sow_min_score <= 100))
      return toast.error("As You Sow cutoff must be 0–100.");
    setSaving(true);
    const { error } = await supabase
      .from("scout_settings")
      .update({
        ratings_enabled: config.enabled,
        just_capital_max_rank: config.just_capital_max_rank,
        as_you_sow_min_score: config.as_you_sow_min_score,
        ratings_mode: config.mode,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved. Applies from the next scan.");
  }

  const result = lookup.trim() ? evaluateCompany(lookup, index, config) : null;

  return (
    <section className="space-y-16">
      <div>
        <SectionHeading title="Employer ratings gate" />
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Before the Job Scout ingests a company's postings, it checks the company against JUST
          Capital's rankings and As You Sow's DEI scores. A company that's on a list and misses the
          cutoff is skipped and its live postings are closed. A company on neither list goes through
          the normal filters. Passing companies get a badge on their postings.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <div className={label}>JUST Capital</div>
          <div className="mt-3 text-3xl font-semibold">
            {list ? `${stats.just.pass} / ${stats.just.total}` : "…"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            pass at rank ≤ {config.just_capital_max_rank}
          </div>
        </div>
        <div className={card}>
          <div className={label}>As You Sow DEI</div>
          <div className="mt-3 text-3xl font-semibold">
            {list ? `${stats.ays.pass} / ${stats.ays.total}` : "…"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            pass at score ≥ {config.as_you_sow_min_score}%
          </div>
        </div>
        <div className={card}>
          <div className={label}>Companies passing</div>
          <div className="mt-3 text-3xl font-semibold">{list ? stats.pass : "…"}</div>
        </div>
        <div className={card}>
          <div className={label}>Companies gated out</div>
          <div className="mt-3 text-3xl font-semibold">{list ? stats.fail : "…"}</div>
        </div>
      </div>

      <form onSubmit={saveConfig} className="max-w-2xl space-y-6">
        <SectionHeading title="Cutoffs" />
        <Toggle
          checked={config.enabled}
          onChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
          label="Gate companies on these ratings"
          description="Off: every company goes through the normal filters; passing companies still aren't badged."
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label="JUST Capital: pass at rank ≤"
            type="number"
            value={String(config.just_capital_max_rank)}
            onChange={(v) => setConfig((c) => ({ ...c, just_capital_max_rank: Number(v) }))}
          />
          <Field
            label="As You Sow: pass at score ≥ (%)"
            type="number"
            value={String(config.as_you_sow_min_score)}
            onChange={(v) => setConfig((c) => ({ ...c, as_you_sow_min_score: Number(v) }))}
          />
        </div>
        <label className="block">
          <span className={label}>When a company is on both lists</span>
          <select
            value={config.mode}
            onChange={(e) =>
              setConfig((c) => ({ ...c, mode: e.target.value as RatingsConfig["mode"] }))
            }
            className={`mt-2 block ${selectCls}`}
          >
            <option value="all">It must pass both</option>
            <option value="any">Passing either is enough</option>
          </select>
        </label>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving ? "…" : "Save cutoffs"}
        </button>
      </form>

      <div className="max-w-2xl">
        <SectionHeading title="Check a company" />
        <div className="mt-4">
          <Field
            label="Company name"
            value={lookup}
            onChange={setLookup}
            placeholder="e.g. Salesforce"
          />
        </div>
        {result && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <Badge
              tone={
                result.verdict === "pass" ? "good" : result.verdict === "fail" ? "bad" : "muted"
              }
            >
              {result.verdict === "unlisted" ? "not listed — normal filters" : result.verdict}
            </Badge>
            <span className="text-muted-foreground">{result.summary}</span>
          </div>
        )}
      </div>

      <div>
        <SectionHeading title="Update the lists" />
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Uploading replaces that list entirely. JUST Capital CSV needs <code>rank</code> and{" "}
          <code>name</code> columns; As You Sow needs <code>name</code> and <code>score</code>{" "}
          (their export works as-is).
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Importer source="just_capital" onImported={load} />
          <Importer source="as_you_sow" onImported={load} />
        </div>
      </div>
    </section>
  );
}

function Importer({ source, onImported }: { source: RatingSource; onImported: () => void }) {
  const [parsed, setParsed] = useState<ReturnType<typeof ratingsFromCsv> | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const result = ratingsFromCsv(source, await file.text());
    setParsed(result);
    if (!result.rows.length) toast.error("No rows found — check the column names.");
  }

  async function replace() {
    if (!parsed?.rows.length) return;
    setBusy(true);
    const { error: delError } = await supabase
      .from("company_ratings")
      .delete()
      .eq("source", source);
    if (delError) {
      setBusy(false);
      return toast.error(delError.message);
    }
    const year = new Date().getFullYear();
    for (let i = 0; i < parsed.rows.length; i += 500) {
      const { error } = await supabase
        .from("company_ratings")
        .insert(parsed.rows.slice(i, i + 500).map((r) => ({ ...r, year })));
      if (error) {
        setBusy(false);
        return toast.error(`Import stopped part-way: ${error.message}. Re-upload to finish.`);
      }
    }
    setBusy(false);
    toast.success(`${RATING_SOURCE_LABEL[source]}: ${parsed.rows.length} companies imported.`);
    setParsed(null);
    onImported();
  }

  return (
    <div className={card}>
      <div className="font-medium">{RATING_SOURCE_LABEL[source]}</div>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => onFile(e.target.files?.[0])}
        className="mt-4 block w-full text-sm file:mr-4 file:rounded-sm file:border file:border-foreground file:bg-transparent file:px-3 file:py-1.5 file:text-[11px] file:uppercase file:tracking-[0.15em]"
      />
      {parsed &&
        (parsed.rows.length ? (
          <div className="mt-4 space-y-3 text-sm">
            <p>
              {parsed.rows.length} companies ready
              {parsed.skipped.length > 0 && `, ${parsed.skipped.length} rows skipped`}.
            </p>
            <button onClick={replace} disabled={busy} className={outlineButton}>
              {busy ? "Importing…" : `Replace ${RATING_SOURCE_LABEL[source]} list`}
            </button>
          </div>
        ) : (
          <Empty>No usable rows in that file.</Empty>
        ))}
    </div>
  );
}
