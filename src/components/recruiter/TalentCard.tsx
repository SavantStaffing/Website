import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Badge,
  TextArea,
  label,
  linkButton,
  mutedButton,
  primaryButton,
  selectCls,
} from "@/components/site/ui";

export type TalentRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  headline: string | null;
  location: string | null;
  current_title: string | null;
  current_company: string | null;
  skills: string[];
  linkedin_url: string | null;
  updated_at: string;
};

export const TALENT_COLUMNS =
  "user_id, first_name, last_name, headline, location, current_title, current_company, skills, linkedin_url, updated_at";

export type OrgJob = { id: string; title: string };

export function talentName(t: TalentRow) {
  return [t.first_name, t.last_name].filter(Boolean).join(" ") || "Name not shared";
}

/** One talent in the recruiter's feed: save / unsave, and "Request Application". */
export function TalentCard({
  talent,
  recruiterId,
  jobs,
  saved,
  requestedJobIds,
  onSavedChange,
  onRequested,
  note,
}: {
  talent: TalentRow;
  recruiterId: string;
  jobs: OrgJob[];
  saved: boolean;
  requestedJobIds: string[];
  onSavedChange: (saved: boolean) => void;
  onRequested: (jobId: string) => void;
  note?: string | null;
}) {
  const [requesting, setRequesting] = useState(false);
  const [jobId, setJobId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function toggleSave() {
    if (saved) {
      const { error } = await supabase
        .from("saved_talent")
        .delete()
        .eq("recruiter_id", recruiterId)
        .eq("talent_id", talent.user_id);
      if (error) return toast.error(error.message);
      onSavedChange(false);
    } else {
      const { error } = await supabase
        .from("saved_talent")
        .insert({ recruiter_id: recruiterId, talent_id: talent.user_id });
      if (error) return toast.error(error.message);
      onSavedChange(true);
      toast.success("Saved.");
    }
  }

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!jobId) return toast.error("Choose a role.");
    setSending(true);
    const { error } = await supabase.from("application_requests").insert({
      recruiter_id: recruiterId,
      talent_id: talent.user_id,
      job_id: jobId,
      message: message.trim() || null,
    });
    setSending(false);
    if (error)
      return toast.error(
        error.code === "23505" ? "You've already invited them to this role." : error.message,
      );
    onRequested(jobId);
    setRequesting(false);
    setMessage("");
    setJobId("");
    toast.success("Invitation sent — they'll get a notification.");
  }

  const available = jobs.filter((j) => !requestedJobIds.includes(j.id));

  return (
    <li className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xl font-medium">{talentName(talent)}</div>
          <div className="mt-1 text-sm">
            {talent.headline ||
              [talent.current_title, talent.current_company].filter(Boolean).join(" at ") ||
              "No headline yet"}
          </div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {talent.location ?? "Location not shared"}
          </div>
          {talent.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {talent.skills.slice(0, 10).map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </div>
          )}
          {note && <p className="mt-3 text-sm text-muted-foreground">Note: {note}</p>}
          {requestedJobIds.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Invited to {requestedJobIds.length} role{requestedJobIds.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-5">
          {talent.linkedin_url && (
            <a
              href={talent.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className={mutedButton}
            >
              LinkedIn ↗
            </a>
          )}
          <button onClick={toggleSave} className={mutedButton} aria-pressed={saved}>
            {saved ? "Saved" : "Save"}
          </button>
          <button
            onClick={() => setRequesting((v) => !v)}
            className={linkButton}
            disabled={jobs.length === 0}
          >
            Request application
          </button>
        </div>
      </div>
      {requesting && (
        <form
          onSubmit={sendRequest}
          className="mt-5 max-w-xl space-y-4 rounded-sm border border-[color:var(--color-hairline)] p-5"
        >
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">You've invited them to every open role.</p>
          ) : (
            <>
              <label className="block">
                <span className={label}>Role</span>
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className={`mt-2 block w-full ${selectCls}`}
                >
                  <option value="">Choose one of your open roles…</option>
                  {available.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </label>
              <TextArea label="Message (optional)" rows={3} value={message} onChange={setMessage} />
              <button type="submit" disabled={sending} className={primaryButton}>
                {sending ? "…" : "Send invitation"}
              </button>
            </>
          )}
        </form>
      )}
    </li>
  );
}
