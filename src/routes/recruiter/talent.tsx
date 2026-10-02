import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  TALENT_COLUMNS,
  TalentCard,
  talentName,
  type TalentRow,
} from "@/components/recruiter/TalentCard";
import { useRecruiterTalentState } from "@/components/recruiter/useRecruiterTalentState";
import { label, list, mutedButton } from "@/components/site/ui";
import { locationMatches } from "@/lib/scout/search";

export const Route = createFileRoute("/recruiter/talent")({
  head: () => ({
    meta: [{ title: "Talent Feed" }, { name: "robots", content: "noindex" }],
  }),
  component: TalentFeed,
});

const PAGE = 30;

function TalentFeed() {
  const { userId, profile } = Route.useRouteContext();
  const state = useRecruiterTalentState(userId, profile.organizationId);
  const [talent, setTalent] = useState<TalentRow[] | null>(null);
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    // RLS only returns profiles whose owners chose to be visible to recruiters.
    supabase
      .from("talent_profiles")
      .select(TALENT_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(1000)
      .then(({ data }) => setTalent((data as TalentRow[]) ?? []));
  }, []);

  const filtered = useMemo(() => {
    if (!talent) return null;
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return talent.filter((t) => {
      const hay = [talentName(t), t.headline, t.current_title, t.current_company, ...t.skills]
        .join(" ")
        .toLowerCase();
      if (terms.some((term) => !hay.includes(term))) return false;
      if (!locationMatches(t.location, loc)) return false;
      return true;
    });
  }, [talent, q, loc]);

  const input =
    "mt-2 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-2 text-base outline-none focus:border-foreground";

  return (
    <section>
      <h2 className="text-2xl font-semibold">Talent feed</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Candidates who've made their profile visible to recruiters. Invite someone to apply and
        they'll get a notification; their contact details are shared with you once they accept.
      </p>
      {!profile.organizationId && (
        <p className="mt-4 text-sm text-muted-foreground">
          You can browse and save talent, but inviting someone needs your account linked to a
          company.
        </p>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className={label}>Skills, title or name</span>
          <input
            className={input}
            value={q}
            onChange={(e) => (setQ(e.target.value), setShown(PAGE))}
            placeholder="forklift osha"
          />
        </label>
        <label className="block">
          <span className={label}>Location</span>
          <input
            className={input}
            value={loc}
            onChange={(e) => (setLoc(e.target.value), setShown(PAGE))}
          />
        </label>
      </div>

      {!filtered || !state.ready ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">No visible talent matches that yet.</p>
      ) : (
        <>
          <p className="mt-8 text-xs text-muted-foreground">{filtered.length} candidates</p>
          <ul className={`mt-3 ${list}`}>
            {filtered.slice(0, shown).map((t) => (
              <TalentCard
                key={t.user_id}
                talent={t}
                recruiterId={userId}
                jobs={state.jobs}
                saved={state.saved.has(t.user_id)}
                requestedJobIds={state.requested.get(t.user_id) ?? []}
                onSavedChange={(v) => state.setSavedFor(t.user_id, v)}
                onRequested={(jobId) => state.addRequest(t.user_id, jobId)}
              />
            ))}
          </ul>
          {filtered.length > shown && (
            <div className="mt-8 text-center">
              <button onClick={() => setShown((n) => n + PAGE)} className={mutedButton}>
                Show more
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
