import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { AvailabilityEditor } from "@/components/talent/AvailabilityEditor";
import { label, primaryButton } from "@/components/site/ui";
import { supabase } from "@/integrations/supabase/client";
import { POSITION_LABELS } from "@/lib/scout/position";
import { NAICS_SECTOR_OPTIONS } from "@/lib/scout/refine";
import {
  EMPTY_AVAILABILITY,
  TRAVEL_OPTIONS,
  zipArea,
  type Availability,
} from "@/lib/talent/intake";

export const Route = createFileRoute("/talent/intake")({
  head: () => ({
    meta: [{ title: "Your Savant intake" }, { name: "robots", content: "noindex" }],
  }),
  component: IntakePage,
});

const OTHER = "other";
const ROLE_OPTIONS = Object.entries(POSITION_LABELS)
  .filter(([k]) => k !== "other")
  .sort((a, b) => a[1].localeCompare(b[1]));

const field =
  "mt-2 block w-full rounded-sm border border-[color:var(--color-hairline)] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-foreground";

/**
 * The talent's introduction to Savant: what they want and when they can
 * work. Saved to talent_preferences (migration 20261014000001); the job feed
 * refines itself to it, and their coach and Savant's admins can see it.
 */
function IntakePage() {
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [industry, setIndustry] = useState("");
  const [industryOther, setIndustryOther] = useState("");
  const [role, setRole] = useState("");
  const [roleOther, setRoleOther] = useState("");
  const [zip, setZip] = useState("");
  const [travel, setTravel] = useState<number | null>(25);
  const [remoteOk, setRemoteOk] = useState(true);
  const [availability, setAvailability] = useState<Availability>(EMPTY_AVAILABILITY);
  const [existing, setExisting] = useState<{ naics_codes: string[]; positions: string[] } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("talent_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data: p }) => {
        if (p) {
          setIndustry(p.intake_industry ?? "");
          setIndustryOther(p.intake_industry_other ?? "");
          setRole(p.intake_role ?? "");
          setRoleOther(p.intake_role_other ?? "");
          setZip(p.home_zip ?? "");
          if (p.intake_completed_at) setTravel(p.travel_miles);
          setRemoteOk(p.remote_ok);
          if (p.availability)
            setAvailability({
              ...EMPTY_AVAILABILITY,
              ...(p.availability as Partial<Availability>),
            });
          setCompletedAt(p.intake_completed_at);
          setExisting({ naics_codes: p.naics_codes ?? [], positions: p.positions ?? [] });
        }
        setLoaded(true);
      });
  }, [userId]);

  const area = useMemo(() => zipArea(zip), [zip]);
  const zipOk = /^\d{5}$/.test(zip) && !!area.state;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!industry) return toast.error("Choose an industry, or Other.");
    if (industry === OTHER && !industryOther.trim()) return toast.error("Tell us which industry.");
    if (!role) return toast.error("Choose a role, or Other.");
    if (role === OTHER && !roleOther.trim()) return toast.error("Tell us which role.");
    if (!zipOk) return toast.error("Enter a valid 5-digit U.S. ZIP code.");
    if (!Object.values(availability).some(Boolean))
      return toast.error("Add at least one day you're available.");

    const roleLabel =
      role === OTHER ? roleOther.trim() : POSITION_LABELS[role as keyof typeof POSITION_LABELS];
    setSaving(true);
    const { error } = await supabase.from("talent_preferences").upsert(
      {
        user_id: userId,
        intake_industry: industry,
        intake_industry_other: industry === OTHER ? industryOther.trim() : null,
        intake_role: role,
        intake_role_other: role === OTHER ? roleOther.trim() : null,
        home_zip: zip,
        home_state: area.state,
        home_metro: area.metro,
        travel_miles: travel,
        remote_ok: remoteOk,
        availability,
        intake_completed_at: completedAt ?? new Date().toISOString(),
        // Seed the feed's ranking preferences if the talent hasn't set any.
        ...(existing?.naics_codes.length || industry === OTHER ? {} : { naics_codes: [industry] }),
        ...(existing?.positions.length ? {} : { positions: [roleLabel] }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved. Your job feed now matches what you told us.");
    navigate({ to: "/talent/jobs" });
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <form onSubmit={submit} className="max-w-2xl">
      <p className={label}>Welcome to Savant</p>
      <h1 className="mt-3 font-display text-3xl font-semibold md:text-4xl">
        {completedAt ? "Your intake" : "Let's get to know you."}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        A few questions so we can show you the right jobs and match you with the right coach. Your
        answers tailor your job feed, and your Savant coach and our team can see them. You can
        change them any time.
      </p>

      <Section n={1} title="Industry" hint="Where would you most like to work?">
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className={field}
          aria-label="Industry"
        >
          <option value="">Choose an industry…</option>
          {NAICS_SECTOR_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
          <option value={OTHER}>Other…</option>
        </select>
        {industry === OTHER && (
          <input
            value={industryOther}
            onChange={(e) => setIndustryOther(e.target.value)}
            maxLength={120}
            placeholder="Which industry?"
            aria-label="Other industry"
            className={field}
          />
        )}
      </Section>

      <Section n={2} title="Role" hint="What kind of work are you looking for?">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={field}
          aria-label="Role"
        >
          <option value="">Choose a role…</option>
          {ROLE_OPTIONS.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
          <option value={OTHER}>Other…</option>
        </select>
        {role === OTHER && (
          <input
            value={roleOther}
            onChange={(e) => setRoleOther(e.target.value)}
            maxLength={120}
            placeholder="Which role? e.g. Dental assistant"
            aria-label="Other role"
            className={field}
          />
        )}
      </Section>

      <Section n={3} title="Location" hint="Where you'd work from, and how far you'd go.">
        <label className="block max-w-[12rem]">
          <span className="text-xs text-muted-foreground">ZIP code</span>
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="94107"
            className={field}
          />
        </label>
        {zip.length === 5 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {zipOk
              ? `You're in ${area.metro ? `the ${area.metro} area, ` : ""}${area.state}.`
              : "We couldn't place that ZIP code. Check it's a U.S. ZIP."}
          </p>
        )}

        <fieldset className="mt-5">
          <legend className="text-xs text-muted-foreground">
            Distance you're willing to travel
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {TRAVEL_OPTIONS.map((o) => {
              const active = travel === o.miles;
              const hint =
                o.miles !== null && o.miles <= 50 && zipOk && !area.metro
                  ? `Jobs in ${area.state} (outside our metro areas)`
                  : o.hint;
              return (
                <label
                  key={o.label}
                  className={`cursor-pointer rounded-sm border px-4 py-3 ${active ? "border-foreground" : "border-[color:var(--color-hairline)]"}`}
                >
                  <input
                    type="radio"
                    name="travel"
                    checked={active}
                    onChange={() => setTravel(o.miles)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className="mt-4 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={remoteOk}
            onChange={(e) => setRemoteOk(e.target.checked)}
            className="h-4 w-4 accent-foreground"
          />
          I'm open to remote jobs too
        </label>
      </Section>

      <Section
        n={4}
        title="Availability"
        hint="When can you work? Turn days on and set your hours."
      >
        <AvailabilityEditor value={availability} onChange={setAvailability} />
      </Section>

      <div className="mt-10 flex flex-wrap items-center gap-6">
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving ? "Saving…" : completedAt ? "Save changes" : "Finish and see my jobs"}
        </button>
        <p className="text-xs text-muted-foreground">
          Distances are by area: up to 50 miles means your metro area, up to 100 means your state.
        </p>
      </div>
    </form>
  );
}

function Section({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-[color:var(--color-hairline)] pt-8">
      <div className="flex items-baseline gap-3">
        <span
          className="font-display text-xl font-semibold text-muted-foreground"
          aria-hidden="true"
        >
          {n}
        </span>
        <div>
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
