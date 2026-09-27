import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ChipGroup, TagInput, Toggle, label, primaryButton, selectCls } from "@/components/site/ui";
import { NAICS_SECTOR_OPTIONS } from "@/lib/scout/refine";
import type { TrackFilter } from "@/lib/scout/rank";
import { JOB_TRACK_BLURBS, JOB_TRACK_LABELS } from "@/lib/scout/track";
import { EMPLOYMENT_TYPE_LABELS, EMPLOYMENT_TYPES, type EmploymentType } from "@/lib/scout/types";

export const Route = createFileRoute("/talent/preferences")({
  head: () => ({
    meta: [{ title: "Preferences" }, { name: "robots", content: "noindex" }],
  }),
  component: Preferences,
});

const FEEDS: { value: TrackFilter; label: string; blurb: string }[] = [
  { value: "all", label: "Both feeds", blurb: "See every role together." },
  { value: "hourly", label: JOB_TRACK_LABELS.hourly, blurb: JOB_TRACK_BLURBS.hourly },
  {
    value: "professional",
    label: JOB_TRACK_LABELS.professional,
    blurb: JOB_TRACK_BLURBS.professional,
  },
];

const WINDOWS = [
  { value: 1, label: "Past 24 hours" },
  { value: 3, label: "Past 3 days" },
  { value: 7, label: "Past week" },
  { value: 14, label: "Past 2 weeks" },
  { value: 30, label: "Past month" },
  { value: 90, label: "Past 3 months" },
];

/** The preference selection that drives "User Feed Ranking". */
function Preferences() {
  const { userId } = Route.useRouteContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [positions, setPositions] = useState<string[]>([]);
  const [naics, setNaics] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [types, setTypes] = useState<EmploymentType[]>([]);
  const [remoteOk, setRemoteOk] = useState(true);
  const [within, setWithin] = useState(30);
  const [feed, setFeed] = useState<TrackFilter>("all");

  useEffect(() => {
    supabase
      .from("talent_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPositions(data.positions);
          setNaics(data.naics_codes);
          setIndustries(data.industries);
          setLocations(data.locations);
          setTypes(data.employment_types as EmploymentType[]);
          setRemoteOk(data.remote_ok);
          setWithin(data.posted_within_days);
          setFeed(data.job_track as TrackFilter);
        }
        setLoading(false);
      });
  }, [userId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("talent_preferences").upsert({
      user_id: userId,
      positions,
      naics_codes: naics,
      industries,
      locations,
      employment_types: types,
      remote_ok: remoteOk,
      posted_within_days: within,
      job_track: feed,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Preferences saved — your feed is re-ranked.");
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <section>
      <h2 className="text-2xl font-semibold">Job preferences</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Your{" "}
        <Link to="/talent/jobs" className="text-foreground underline underline-offset-4">
          job feed
        </Link>{" "}
        ranks roles by how well they match these. Nothing here hides a role — use the feed's filters
        for that.
      </p>

      <form onSubmit={save} className="mt-10 max-w-2xl space-y-8">
        <fieldset>
          <legend className={label}>Which roles are you looking for?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {FEEDS.map((f) => (
              <label
                key={f.value}
                className={`cursor-pointer border p-4 text-sm transition-colors ${
                  feed === f.value
                    ? "border-foreground"
                    : "border-[color:var(--color-hairline)] text-muted-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="feed"
                  value={f.value}
                  checked={feed === f.value}
                  onChange={() => setFeed(f.value)}
                  className="sr-only"
                />
                <span className="block font-medium text-foreground">{f.label}</span>
                <span className="mt-1 block text-xs">{f.blurb}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Your feed opens on this one. You can switch feeds any time from the tabs at the top.
          </p>
        </fieldset>
        <TagInput
          label="Positions"
          value={positions}
          onChange={setPositions}
          placeholder="e.g. Warehouse associate, CNA, Software engineer"
        />
        <div>
          <span className={label}>Industries (NAICS sectors)</span>
          <div className="mt-3">
            <ChipGroup
              options={NAICS_SECTOR_OPTIONS.map((o) => ({ value: o.code, label: o.label }))}
              value={naics}
              onChange={(codes) => {
                setNaics(codes);
                setIndustries(
                  NAICS_SECTOR_OPTIONS.filter((o) => codes.includes(o.code)).map((o) => o.label),
                );
              }}
            />
          </div>
        </div>
        <TagInput
          label="Locations"
          value={locations}
          onChange={setLocations}
          placeholder="City or state, press Enter"
        />
        <Toggle checked={remoteOk} onChange={setRemoteOk} label="Open to remote roles" />
        <div>
          <span className={label}>Schedule</span>
          <div className="mt-3">
            <ChipGroup
              options={EMPLOYMENT_TYPES.map((t) => ({
                value: t,
                label: EMPLOYMENT_TYPE_LABELS[t],
              }))}
              value={types}
              onChange={setTypes}
            />
          </div>
        </div>
        <label className="block">
          <span className={label}>Show roles posted within</span>
          <select
            value={within}
            onChange={(e) => setWithin(Number(e.target.value))}
            className={`mt-2 block ${selectCls}`}
          >
            {WINDOWS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving ? "…" : "Save preferences"}
        </button>
      </form>
    </section>
  );
}
