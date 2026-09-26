import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ChipGroup, TagInput, Toggle, label, primaryButton, selectCls } from "@/components/site/ui";
import { NAICS_SECTOR_OPTIONS } from "@/lib/scout/refine";
import { EMPLOYMENT_TYPE_LABELS, EMPLOYMENT_TYPES, type EmploymentType } from "@/lib/scout/types";

export const Route = createFileRoute("/talent/preferences")({
  head: () => ({
    meta: [{ title: "Preferences" }, { name: "robots", content: "noindex" }],
  }),
  component: Preferences,
});

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
