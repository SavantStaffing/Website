import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TALENT_COLUMNS, TalentCard, type TalentRow } from "@/components/recruiter/TalentCard";
import { useRecruiterTalentState } from "@/components/recruiter/useRecruiterTalentState";
import { list } from "@/components/site/ui";

export const Route = createFileRoute("/recruiter/saved")({
  head: () => ({
    meta: [{ title: "Saved Talent" }, { name: "robots", content: "noindex" }],
  }),
  component: SavedTalent,
});

function SavedTalent() {
  const { userId, profile } = Route.useRouteContext();
  const state = useRecruiterTalentState(userId, profile.organizationId);
  const [talent, setTalent] = useState<TalentRow[] | null>(null);

  useEffect(() => {
    if (!state.ready) return;
    const ids = [...state.saved.keys()];
    if (ids.length === 0) return setTalent([]);
    supabase
      .from("talent_profiles")
      .select(TALENT_COLUMNS)
      .in("user_id", ids)
      .then(({ data }) => setTalent((data as TalentRow[]) ?? []));
    // Only reload when the saved list is first ready; unsaving just hides the row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ready]);

  const rows = talent?.filter((t) => state.saved.has(t.user_id)) ?? null;

  return (
    <section>
      <h2 className="text-2xl font-semibold">Saved talent</h2>
      {!rows ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Nobody saved yet.{" "}
          <Link to="/recruiter/talent" className="text-foreground underline underline-offset-4">
            Browse the talent feed
          </Link>
          .
        </p>
      ) : (
        <ul className={`mt-8 ${list}`}>
          {rows.map((t) => (
            <TalentCard
              key={t.user_id}
              talent={t}
              recruiterId={userId}
              jobs={state.jobs}
              saved
              note={state.saved.get(t.user_id)}
              requestedJobIds={state.requested.get(t.user_id) ?? []}
              onSavedChange={(v) => state.setSavedFor(t.user_id, v)}
              onRequested={(jobId) => state.addRequest(t.user_id, jobId)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
