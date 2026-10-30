import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, TextArea, TagInput, primaryButton, mutedButton } from "@/components/site/ui";

type Editable = {
  first_name: string; last_name: string; headline: string; current_title: string;
  current_company: string; location: string; linkedin_url: string; github_url: string;
  portfolio_url: string; salary_expectation: string; earliest_start: string;
  resume_text: string; skills: string[]; work_authorized: boolean | null;
  needs_sponsorship: boolean | null;
};
const fields = [
  ["first_name", "First name"], ["last_name", "Last name"], ["headline", "Headline"],
  ["current_title", "Current title"], ["current_company", "Current company"],
  ["location", "Location"], ["linkedin_url", "LinkedIn"], ["github_url", "GitHub"],
  ["portfolio_url", "Portfolio"], ["salary_expectation", "Salary expectation"],
  ["earliest_start", "Earliest start"]
] as const;
const blank: Editable = {
  first_name: "", last_name: "", headline: "", current_title: "", current_company: "",
  location: "", linkedin_url: "", github_url: "", portfolio_url: "",
  salary_expectation: "", earliest_start: "", resume_text: "",
  skills: [], work_authorized: null, needs_sponsorship: null
};
function BooleanField({ label, value, onChange }: {
  label: string; value: boolean | null; onChange: (v: boolean | null) => void;
}) {
  return <label className="block text-sm">{label}
    <select className="mt-2 block border bg-transparent p-2"
      value={value === null ? "" : String(value)}
      onChange={e => onChange(e.target.value === "" ? null : e.target.value === "true")}>
      <option value="">Not specified</option><option value="true">Yes</option><option value="false">No</option>
    </select>
  </label>;
}
export function CoachEditTalentProfile({ talentId, onSaved }: {
  talentId: string; onSaved: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Editable>(blank);
  useEffect(() => {
    if (!editing) return;
    let active = true;
    setLoading(true);
    void supabase.from("talent_profiles").select("*").eq("user_id", talentId).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setLoading(false);
        if (error || !data) {
          toast.error(error?.message ?? "This talent has not created a profile yet.");
          setEditing(false);
          return;
        }
        setForm({
          ...blank,
          ...Object.fromEntries(Object.keys(blank).map(k => [
            k, (data as unknown as Record<string, unknown>)[k] ?? blank[k as keyof Editable]
          ]))
        } as Editable);
      });
    return () => { active = false; };
  }, [editing, talentId]);
  const set = (key: keyof Editable) => (value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    for (const [key] of fields) {
      const value = form[key].trim();
      const max = key === "headline" ? 160 :
        ["first_name", "last_name", "salary_expectation", "earliest_start"].includes(key) ? 80 :
        key.endsWith("_url") ? 500 : 120;
      if (value.length > max) { toast.error(key + " is too long"); return; }
      if (key.endsWith("_url") && value) {
        try { if (!["http:", "https:"].includes(new URL(value).protocol)) throw new Error(); }
        catch { toast.error("Enter a valid URL."); return; }
      }
    }
    if (form.resume_text.length > 60000) { toast.error("Résumé text is too long"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("coach_update_talent_profile" as never, {
      _talent_id: talentId, _changes: form
    } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Talent profile updated");
    setEditing(false);
    await onSaved();
  }
  if (!editing) return <button type="button" className={mutedButton}
    onClick={() => setEditing(true)}>Edit talent profile</button>;
  return <div className="mt-6 max-w-3xl space-y-5 rounded-sm border p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-xl font-semibold">Edit talent profile</h3>
      <button type="button" className={mutedButton} disabled={saving}
        onClick={() => setEditing(false)}>Cancel</button>
    </div>
    <p className="text-sm text-muted-foreground">
      Changes update the talent's own professional profile. Contact and visibility settings remain talent-controlled.
    </p>
    {loading ? <p>Loading…</p> : <form onSubmit={save} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([key, caption]) => <Field key={key} label={caption}
          value={form[key]} onChange={set(key)} />)}
      </div>
      <TagInput label="Skills" value={form.skills}
        onChange={skills => setForm(f => ({ ...f, skills }))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <BooleanField label="Authorized to work in the US" value={form.work_authorized}
          onChange={work_authorized => setForm(f => ({ ...f, work_authorized }))} />
        <BooleanField label="Requires visa sponsorship" value={form.needs_sponsorship}
          onChange={needs_sponsorship => setForm(f => ({ ...f, needs_sponsorship }))} />
      </div>
      <TextArea label="Résumé (plain text)" rows={8} value={form.resume_text}
        onChange={set("resume_text")} />
      <button type="submit" disabled={saving} className={primaryButton}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>}
  </div>;
}
