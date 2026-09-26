import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OrgJob } from "./TalentCard";

/** Org jobs, saved talent and sent invitations — what both talent pages need alongside the list. */
export function useRecruiterTalentState(recruiterId: string, organizationId: string | null) {
  const [jobs, setJobs] = useState<OrgJob[]>([]);
  const [saved, setSaved] = useState<Map<string, string | null>>(new Map());
  const [requested, setRequested] = useState<Map<string, string[]>>(new Map());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: jobRows }, { data: savedRows }, { data: reqRows }] = await Promise.all([
        organizationId
          ? supabase
              .from("jobs")
              .select("id, title")
              .eq("organization_id", organizationId)
              .eq("status", "active")
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as OrgJob[] }),
        supabase.from("saved_talent").select("talent_id, note").eq("recruiter_id", recruiterId),
        supabase
          .from("application_requests")
          .select("talent_id, job_id")
          .eq("recruiter_id", recruiterId),
      ]);
      setJobs(jobRows ?? []);
      setSaved(new Map((savedRows ?? []).map((r) => [r.talent_id, r.note])));
      const byTalent = new Map<string, string[]>();
      for (const r of reqRows ?? [])
        byTalent.set(r.talent_id, [...(byTalent.get(r.talent_id) ?? []), r.job_id]);
      setRequested(byTalent);
      setReady(true);
    })();
  }, [recruiterId, organizationId]);

  return {
    ready,
    jobs,
    saved,
    requested,
    setSavedFor(talentId: string, isSaved: boolean) {
      setSaved((prev) => {
        const next = new Map(prev);
        if (isSaved) next.set(talentId, null);
        else next.delete(talentId);
        return next;
      });
    },
    addRequest(talentId: string, jobId: string) {
      setRequested((prev) => new Map(prev).set(talentId, [...(prev.get(talentId) ?? []), jobId]));
    },
  };
}
