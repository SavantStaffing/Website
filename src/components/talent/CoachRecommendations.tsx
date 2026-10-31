import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeading, mutedButton, outlineButton, timeAgo } from "@/components/site/ui";

type Action = "build_workspace" | "independent_research" | "internships" | "follow_up";
type Recommendation = {
  id: string; talent_id: string; coach_id: string; action: Action; employer: string | null;
  note: string | null; status: "recommended" | "completed"; created_at: string;
};
const ACTIONS: { id: Action; label: string; help: string }[] = [
  { id: "build_workspace", label: "Build Workspace", help: "Create a portfolio or organized work area to demonstrate skills." },
  { id: "independent_research", label: "Independent Research", help: "Research the field, employers and career pathways." },
  { id: "internships", label: "Internships", help: "Explore opportunities on the internship feed." },
  { id: "follow_up", label: "Follow up", help: "Follow up with an employer about an application or conversation." },
];
const db = supabase as any;

export function CoachRecommendations({ talentId, canEdit = false }: { talentId: string; canEdit?: boolean }) {
  const [rows, setRows] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Action | null>(null);
  const [employers, setEmployers] = useState<string[]>([]);
  const [employer, setEmployer] = useState("");
  const [customEmployer, setCustomEmployer] = useState("");
  const [note, setNote] = useState("");

  const reload = useCallback(async () => {
    const { data, error } = await db.from("coach_recommendations").select("*")
      .eq("talent_id", talentId).order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Recommendation[]);
  }, [talentId]);
  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!canEdit) return;
    (async () => {
      const [apps, shared] = await Promise.all([
        db.from("job_applications").select("external_company, jobs(company_name)").eq("applicant_id", talentId),
        db.from("shared_jobs").select("external_company, jobs(company_name)").eq("talent_id", talentId),
      ]);
      const names = [...(apps.data ?? []), ...(shared.data ?? [])]
        .map((r: any) => r.external_company ?? r.jobs?.company_name)
        .filter((s: unknown): s is string => typeof s === "string" && !!s.trim());
      setEmployers([...new Set(names)].sort());
    })();
  }, [canEdit, talentId]);

  async function create() {
    if (!selected) return;
    const chosenEmployer = employer === "__other" ? customEmployer.trim() : employer.trim();
    if (selected === "follow_up" && !chosenEmployer) return toast.error("Choose an employer.");
    setBusy(true);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await db.from("coach_recommendations").insert({
      talent_id: talentId, coach_id: user.user?.id, action: selected,
      employer: selected === "follow_up" ? chosenEmployer : null, note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Coach recommendation added.");
    setSelected(null); setEmployer(""); setCustomEmployer(""); setNote("");
    void reload();
  }
  async function setStatus(r: Recommendation) {
    setBusy(true);
    const status = r.status === "completed" ? "recommended" : "completed";
    const { error } = await db.from("coach_recommendations").update({ status })
      .eq("id", r.id).eq("talent_id", talentId);
    setBusy(false);
    if (error) return toast.error(error.message);
    void reload();
  }
  async function remove(r: Recommendation) {
    setBusy(true);
    const { error } = await db.from("coach_recommendations").delete().eq("id", r.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    void reload();
  }

  return (
    <section>
      <SectionHeading title="Coach's Recommendation" />
      <p className="mt-2 text-sm text-muted-foreground">
        {canEdit ? "Select an action to recommend. Your talent will see the same checklist." : "Actions your coach recommends. Mark each one complete as you make progress."}
      </p>
      {canEdit && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ACTIONS.map(a => (
            <button key={a.id} type="button" onClick={() => setSelected(a.id)}
              className={`min-h-28 rounded-sm border p-4 text-left transition-colors ${selected === a.id ? "border-foreground bg-foreground/5" : "border-[color:var(--color-hairline)] hover:border-foreground"}`}>
              <span className="block font-medium">{a.label}</span>
              <span className="mt-2 block text-xs text-muted-foreground">{a.help}</span>
            </button>
          ))}
        </div>
      )}
      {canEdit && selected && (
        <div role="dialog" aria-label="Create coach recommendation" className="mt-4 max-w-xl space-y-4 rounded-sm border border-[color:var(--color-hairline)] p-5">
          <h3 className="font-medium">Recommend {ACTIONS.find(a => a.id === selected)?.label}</h3>
          {selected === "follow_up" && (
            <label className="block text-sm">Employer
              <select className="mt-2 w-full rounded-sm border border-[color:var(--color-hairline)] bg-background p-2"
                value={employer} onChange={e => setEmployer(e.target.value)}>
                <option value="">Choose an employer</option>
                {employers.map(e => <option key={e} value={e}>{e}</option>)}
                <option value="__other">Another employer…</option>
              </select>
            </label>
          )}
          {selected === "follow_up" && employer === "__other" && (
            <label className="block text-sm">Employer name
              <input className="mt-2 w-full border border-[color:var(--color-hairline)] bg-transparent p-2"
                maxLength={200} value={customEmployer} onChange={e => setCustomEmployer(e.target.value)} />
            </label>
          )}
          <label className="block text-sm">Coach's note (optional)
            <textarea className="mt-2 w-full border border-[color:var(--color-hairline)] bg-transparent p-2"
              maxLength={1000} rows={3} value={note} onChange={e => setNote(e.target.value)} />
          </label>
          <div className="flex gap-4">
            <button className={outlineButton} disabled={busy} onClick={() => void create()}>Add recommendation</button>
            <button className={mutedButton} onClick={() => setSelected(null)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="mt-6 rounded-sm border border-[color:var(--color-hairline)] p-5">
        <h3 className="font-medium">Recommended actions <span className="text-muted-foreground">({rows.filter(r => r.status !== "completed").length} open)</span></h3>
        {loading ? <p className="mt-4 text-sm">Loading…</p> : rows.length === 0 ?
          <p className="mt-4 text-sm text-muted-foreground">No recommendations yet.</p> : (
          <ul className="mt-4 divide-y divide-[color:var(--color-hairline)]">
            {rows.map(r => <li key={r.id} className="flex flex-wrap items-start gap-4 py-4">
              <input type="checkbox" aria-label={`Complete ${r.action}`} checked={r.status === "completed"}
                disabled={busy} onChange={() => void setStatus(r)} className="mt-1 size-4" />
              <div className="min-w-0 flex-1">
                <div className={r.status === "completed" ? "font-medium line-through opacity-60" : "font-medium"}>
                  {ACTIONS.find(a => a.id === r.action)?.label ?? r.action}{r.employer ? ` — ${r.employer}` : ""}
                </div>
                {r.note && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{r.note}</p>}
                <div className="mt-1 text-xs text-muted-foreground">{timeAgo(r.created_at)}</div>
                {r.action === "internships" && <Link to="/talent/internships" className="mt-2 inline-block text-sm underline underline-offset-4">Explore internships →</Link>}
              </div>
              {canEdit && <button disabled={busy} className={mutedButton} onClick={() => void remove(r)}>Remove</button>}
            </li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
