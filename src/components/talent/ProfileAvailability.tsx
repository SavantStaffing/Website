import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AvailabilityEditor } from "@/components/talent/AvailabilityEditor";
import { primaryButton } from "@/components/site/ui";
import { EMPTY_AVAILABILITY, DAYS, type Availability } from "@/lib/talent/intake";

/** Edits the same weekly schedule used by Talent Intake and the staff dashboards. */
export function ProfileAvailability({ userId }: { userId: string }) {
  const [availability, setAvailability] = useState<Availability>({ ...EMPTY_AVAILABILITY });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.from("talent_preferences").select("availability")
      .eq("user_id", userId).maybeSingle().then(({ data, error }) => {
        if (!active) return;
        if (error) toast.error(error.message);
        else if (data?.availability && typeof data.availability === "object") {
          setAvailability({
            ...EMPTY_AVAILABILITY,
            ...(data.availability as Partial<Availability>),
          });
        }
        setLoaded(true);
      });
    return () => { active = false; };
  }, [userId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    const slots = DAYS.map(day => availability[day]).filter(slot => slot !== null);
    if (!slots.length) {
      toast.error("Choose at least one available day.");
      return;
    }
    if (slots.some(slot => !slot || slot.start >= slot.end)) {
      toast.error("Each selected day needs an end time after its start time.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("talent_preferences").upsert({
      user_id: userId,
      availability,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Weekly availability saved.");
  }

  return (
    <div id="availability" className="scroll-mt-24">
      <h2 className="text-2xl font-semibold">Weekly availability</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        When are you generally available to work? Start with a quick preset, then
        adjust individual days and hours. Your coach and Savant team can see this schedule.
        You can update it whenever your availability changes.
      </p>
      {!loaded ? <p className="mt-5 text-sm text-muted-foreground">Loading…</p> : (
        <form onSubmit={save} className="mt-6 max-w-2xl space-y-5">
          <AvailabilityEditor value={availability} onChange={setAvailability} />
          <button type="submit" disabled={saving} className={primaryButton}>
            {saving ? "Saving…" : "Save availability"}
          </button>
        </form>
      )}
    </div>
  );
}
