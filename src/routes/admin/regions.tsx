import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Badge, list, selectCls, Stat, timeAgo } from "@/components/site/ui";
import {
  resolveRegions,
  type RegionDemand,
  type RegionOverride,
  type RegionStatus,
} from "@/lib/scout/location";

export const Route = createFileRoute("/admin/regions")({
  head: () => ({
    meta: [{ title: "Regional scanners" }, { name: "robots", content: "noindex" }],
  }),
  component: RegionalScanners,
});

const WHY: Record<RegionStatus["why"], { label: string; tone: "good" | "warn" | "muted" | "bad" }> =
  {
    baseline: { label: "Baseline", tone: "good" },
    active_talent: { label: "Active talent", tone: "good" },
    override_on: { label: "Forced on", tone: "warn" },
    override_off: { label: "Forced off", tone: "bad" },
    idle: { label: "Idle", tone: "muted" },
  };

/**
 * The Job Scout's metros and whether each is being scanned. Baseline metros
 * always scan; others switch on while a talent who lives there has been
 * active recently. An admin can force any metro on or off.
 */
function RegionalScanners() {
  const { auth } = useAuth();
  const [regions, setRegions] = useState<RegionStatus[] | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [demand, overrides, settings] = await Promise.all([
      supabase.rpc("scout_region_demand"),
      supabase.from("scout_region_overrides").select("metro, mode"),
      supabase.from("scout_settings").select("region_active_days").eq("id", 1).maybeSingle(),
    ]);
    const error = demand.error ?? overrides.error ?? settings.error;
    if (error) toast.error(error.message);
    setDays(settings.data?.region_active_days ?? 21);
    setRegions(
      resolveRegions(
        (demand.data ?? []) as RegionDemand[],
        Object.fromEntries((overrides.data ?? []).map((o) => [o.metro, o.mode as RegionOverride])),
      ),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setMode(metro: string, mode: "auto" | RegionOverride) {
    setSaving(metro);
    const { error } =
      mode === "auto"
        ? await supabase.from("scout_region_overrides").delete().eq("metro", metro)
        : await supabase
            .from("scout_region_overrides")
            .upsert({ metro, mode, updated_by: auth?.userId ?? null });
    setSaving(null);
    if (error) return toast.error(error.message);
    await load();
  }

  async function saveDays(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 365)
      return toast.error("Enter 1 to 365 days");
    const { error } = await supabase
      .from("scout_settings")
      .update({ region_active_days: value })
      .eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success(`Talent count as active for ${value} days`);
    await load();
  }

  const scanning = regions?.filter((r) => r.active).length;

  return (
    <section>
      <h2 className="text-2xl font-semibold">Regional scanners</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Which metros the Job Scout's job-search APIs cover, and whose postings it prefers when it
        caps an employer's listings. Baseline metros always scan. Any other metro switches on while
        at least one talent whose home ZIP is there has used the site in the last {days ?? "…"}{" "}
        days, and back off once they've all been away longer. Forced on or off beats both.
        Careers-site scans stay nationwide (U.S. only) either way.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Metros scanning" value={scanning} />
        <Stat label="Active talent" value={regions?.reduce((n, r) => n + r.activeTalent, 0)} />
        <Stat
          label="Activity window"
          value={
            days === null ? undefined : (
              <input
                type="number"
                min={1}
                max={365}
                defaultValue={days}
                key={days}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v !== days) saveDays(v);
                }}
                className="w-24 border-b border-[color:var(--color-hairline)] bg-transparent text-4xl font-semibold outline-none"
                aria-label="Days a talent counts as active"
              />
            )
          }
        >
          <p className="mt-2 text-xs text-muted-foreground">days since last visit</p>
        </Stat>
      </div>

      {!regions ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className={`mt-8 ${list}`}>
          {regions.map((r) => {
            const why = WHY[r.why];
            return (
              <li
                key={r.metro.name}
                className="flex flex-wrap items-start justify-between gap-4 py-5"
              >
                <div className="min-w-0 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.metro.name}</span>
                    <Badge tone={r.active ? "good" : "muted"}>
                      {r.active ? "Scanning" : "Off"}
                    </Badge>
                    <Badge tone={why.tone}>{why.label}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {r.activeTalent === 1 ? "1 active talent" : `${r.activeTalent} active talent`}
                    {r.lastActiveAt && <> · last talent visit {timeAgo(r.lastActiveAt)}</>}
                    {r.metro.active && <> · baseline metro</>}
                    {" · "}
                    Searches near {r.metro.anchors.join(", ")}
                  </div>
                </div>
                <select
                  value={r.override ?? "auto"}
                  disabled={saving === r.metro.name}
                  onChange={(e) => setMode(r.metro.name, e.target.value as "auto" | RegionOverride)}
                  className={selectCls}
                  aria-label={`Scanner for ${r.metro.name}`}
                >
                  <option value="auto">Automatic</option>
                  <option value="on">Force on</option>
                  <option value="off">Force off</option>
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
