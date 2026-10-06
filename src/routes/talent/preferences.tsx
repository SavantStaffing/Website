import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ChipGroup, TagInput, Toggle, label, primaryButton, selectCls } from "@/components/site/ui";
import { NAICS_SECTOR_OPTIONS } from "@/lib/scout/refine";
import type { TrackFilter } from "@/lib/scout/rank";
import { JOB_TRACK_BLURBS, JOB_TRACK_LABELS } from "@/lib/scout/track";
import { EMPLOYMENT_TYPE_LABELS, EMPLOYMENT_TYPES, type EmploymentType } from "@/lib/scout/types";
import { PARTNER_IDS, PARTNER_NAMES, type PartnerId } from "@/data/temp-listings";

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

const PAY_FLOORS = [15, 18, 20, 22, 25, 30, 40, 50];

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
  const [minPay, setMinPay] = useState<number | null>(null);
  const [tempApps, setTempApps] = useState<PartnerId[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fairChanceOnly, setFairChanceOnly] = useState(false);

  useEffect(() => {
    supabase
      .from("talent_private_preferences")
      .select("fair_chance_only")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setFairChanceOnly(!!data?.fair_chance_only));
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
          setMinPay(data.min_hourly_pay === null ? null : Number(data.min_hourly_pay));
          setTempApps(data.temp_apps as PartnerId[]);
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
      min_hourly_pay: minPay,
      temp_apps: tempApps,
    });
    // Kept in its own table that only the talent can read.
    const { error: privateError } = error
      ? { error: null }
      : await supabase
          .from("talent_private_preferences")
          .upsert({ user_id: userId, fair_chance_only: fairChanceOnly });
    setSaving(false);
    if (error) return toast.error(error.message);
    if (privateError) return toast.error(privateError.message);
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
        for that. (The one exception is under Advanced preferences.)
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
          <span className={label}>Industries</span>
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
          <span className={label}>Minimum pay</span>
          <select
            value={minPay === null ? "" : String(minPay)}
            onChange={(e) => setMinPay(e.target.value ? Number(e.target.value) : null)}
            className={`mt-2 block ${selectCls}`}
          >
            <option value="">No minimum</option>
            {PAY_FLOORS.map((n) => (
              <option key={n} value={n}>
                ${n}/hr or more
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">
            Roles that pay this or more rank higher. Salaries are compared as an hourly rate.
          </span>
        </label>
        <div>
          <span className={label}>Temp apps you use</span>
          <div className="mt-3">
            <ChipGroup
              options={PARTNER_IDS.map((id) => ({ value: id, label: PARTNER_NAMES[id] }))}
              value={tempApps}
              onChange={setTempApps}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Shifts on these apps rank higher in your Temp & hourly feed.{" "}
            <Link
              to="/talent/temporary-work"
              className="text-foreground underline underline-offset-4"
            >
              Compare the apps
            </Link>
          </p>
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
        <div className="border-t border-[color:var(--color-hairline)] pt-6">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            aria-expanded={advancedOpen}
            className="text-[12px] uppercase tracking-[0.2em] text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
          >
            {advancedOpen ? "− Hide" : "+ Show"} advanced preferences
          </button>
          {advancedOpen && (
            <div className="mt-5">
              <span className={label}>Background</span>
              <div className="mt-2">
                <Toggle
                  checked={fairChanceOnly}
                  onChange={setFairChanceOnly}
                  label="Felony conviction — only show me fair-chance roles"
                  description="Your feed will only show roles from employers and apps on our fair-chance list. This is private: only you can see it — not recruiters, coaches or Savant staff."
                />
              </div>
            </div>
          )}
        </div>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving ? "…" : "Save preferences"}
        </button>
      </form>
    </section>
  );
}
