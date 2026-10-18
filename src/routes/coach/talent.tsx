import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Badge,
  Empty,
  SectionHeading,
  label,
  linkButton,
  list,
  mutedButton,
  timeAgo,
} from "@/components/site/ui";
import { AssignedTalentList } from "@/components/talent/AssignedTalentList";

export const Route = createFileRoute("/coach/talent")({
  head: () => ({
    meta: [{ title: "Talent" }, { name: "robots", content: "noindex" }],
  }),
  component: CoachTalent,
});

type DirectoryRow = {
  talent_id: string;
  display_name: string;
  headline: string | null;
  current_title: string | null;
  location: string | null;
  skills: string[];
  joined_at: string;
  assignment_status: string | null;
  has_resume: boolean;
};

/** How long a résumé link opened from here stays valid. */
const RESUME_LINK_SECONDS = 600;

/**
 * Coaches see full profiles only for talent assigned to them. To pick up
 * someone new they browse a limited directory (no contact details —
 * public.coach_talent_directory) and ask; an admin approves. Résumés of
 * talent who keep their profile visible can be read before that
 * (public.coach_talent_resume, migration 20261018000003).
 */
function CoachTalent() {
  const { userId } = Route.useRouteContext();
  const [rows, setRows] = useState<DirectoryRow[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // Résumé text, fetched when first opened.
  const [resumes, setResumes] = useState<Record<string, string | null>>({});
  const [openResume, setOpenResume] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("coach_talent_directory").then(({ data, error }) => {
      if (error) {
        toast.error(error.message);
        return setRows([]);
      }
      setRows((data as DirectoryRow[]) ?? []);
    });
  }, []);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const others = (rows ?? []).filter((r) => r.assignment_status !== "active");
    if (!term) return others;
    return others.filter((r) =>
      [r.display_name, r.headline, r.current_title, r.location, ...r.skills]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [rows, q]);

  const setStatus = (id: string, status: string | null) =>
    setRows(
      (prev) =>
        prev?.map((r) => (r.talent_id === id ? { ...r, assignment_status: status } : r)) ?? null,
    );

  async function request(r: DirectoryRow) {
    setBusy(r.talent_id);
    // A declined request is renewed in place (one row per coach and talent).
    const { error } =
      r.assignment_status === "declined"
        ? await supabase
            .from("talent_assignments")
            .update({ status: "requested" })
            .eq("talent_id", r.talent_id)
            .eq("staff_id", userId)
        : await supabase.from("talent_assignments").insert({
            talent_id: r.talent_id,
            staff_id: userId,
            staff_role: "career_coach",
            status: "requested",
            requested_by: userId,
          });
    setBusy(null);
    if (error) return toast.error(error.message);
    setStatus(r.talent_id, "requested");
    toast.success(`Request sent. An admin will review it.`);
  }

  async function fetchResume(id: string) {
    const { data, error } = await supabase.rpc("coach_talent_resume", { _talent: id });
    if (error) {
      toast.error(error.message);
      return null;
    }
    return data?.[0] ?? null;
  }

  async function openResumeFile(r: DirectoryRow) {
    setBusy(r.talent_id);
    const resume = await fetchResume(r.talent_id);
    if (!resume) return setBusy(null);
    if (!resume.resume_path) {
      setBusy(null);
      return toast.error("No résumé file uploaded. Try Read résumé.");
    }
    const { data, error } = await supabase.storage
      .from("resumes")
      .createSignedUrl(resume.resume_path, RESUME_LINK_SECONDS);
    setBusy(null);
    if (error || !data) return toast.error(error?.message ?? "Couldn't open the résumé");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function toggleResumeText(r: DirectoryRow) {
    if (openResume === r.talent_id) return setOpenResume(null);
    if (!(r.talent_id in resumes)) {
      setBusy(r.talent_id);
      const resume = await fetchResume(r.talent_id);
      setBusy(null);
      if (!resume) return;
      setResumes((prev) => ({ ...prev, [r.talent_id]: resume.resume_text?.trim() || null }));
    }
    setOpenResume(r.talent_id);
  }

  async function withdraw(r: DirectoryRow) {
    setBusy(r.talent_id);
    const { error } = await supabase
      .from("talent_assignments")
      .delete()
      .eq("talent_id", r.talent_id)
      .eq("staff_id", userId)
      .eq("status", "requested");
    setBusy(null);
    if (error) return toast.error(error.message);
    setStatus(r.talent_id, null);
  }

  return (
    <section className="space-y-16">
      <div>
        <SectionHeading title="Your talent" />
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          People an admin has assigned you to coach, with their full profile, contact details and
          résumé. Ask any of them to meet: offer three times and they pick one. Talent from
          coaching requests assigned to you are on Service Requests.
        </p>
        <AssignedTalentList
          staffId={userId}
          canRequestMeetings
          emptyText="No one assigned yet. Ask to coach someone below, or wait for an admin to assign you."
        />
      </div>

      <div>
        <SectionHeading title="Find talent to coach" />
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Read résumés of talent who keep their profile visible, then ask to coach someone and a
          Savant admin will review the request. Contact details unlock once you're assigned.
        </p>
        <label className="mt-6 block max-w-md">
          <span className={label}>Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, title, skill, location…"
            className="mt-2 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-2 text-base outline-none focus:border-foreground"
          />
        </label>
        {!rows ? (
          <Empty>Loading…</Empty>
        ) : visible.length === 0 ? (
          <Empty>No talent found.</Empty>
        ) : (
          <>
            <p className="mt-6 text-xs text-muted-foreground">{visible.length} talent</p>
            <ul className={`mt-3 ${list}`}>
              {visible.map((r) => (
                <li key={r.talent_id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-medium">{r.display_name}</span>
                        {r.assignment_status === "requested" && (
                          <Badge tone="warn">Requested</Badge>
                        )}
                        {r.assignment_status === "declined" && <Badge>Not approved</Badge>}
                      </div>
                      {(r.headline || r.current_title || r.location) && (
                        <div className="mt-1 text-sm">
                          {[r.headline || r.current_title, r.location].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">
                        joined {timeAgo(r.joined_at)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      {r.has_resume && (
                        <>
                          <button
                            onClick={() => openResumeFile(r)}
                            disabled={busy === r.talent_id}
                            className={mutedButton}
                          >
                            Open résumé ↗
                          </button>
                          <button
                            onClick={() => toggleResumeText(r)}
                            disabled={busy === r.talent_id}
                            className={mutedButton}
                            aria-expanded={openResume === r.talent_id}
                          >
                            {openResume === r.talent_id ? "Hide résumé" : "Read résumé"}
                          </button>
                        </>
                      )}
                      {r.assignment_status === "requested" ? (
                        <button
                          onClick={() => withdraw(r)}
                          disabled={busy === r.talent_id}
                          className={mutedButton}
                        >
                          Withdraw request
                        </button>
                      ) : (
                        <button
                          onClick={() => request(r)}
                          disabled={busy === r.talent_id}
                          className={linkButton}
                        >
                          {r.assignment_status === "declined"
                            ? "Ask again →"
                            : "Request to coach →"}
                        </button>
                      )}
                    </div>
                  </div>
                  {r.skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.skills.slice(0, 8).map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                    </div>
                  )}
                  {openResume === r.talent_id && (
                    <pre className="mt-4 max-h-96 max-w-4xl overflow-auto whitespace-pre-wrap rounded-sm border border-[color:var(--color-hairline)] p-4 font-sans text-sm leading-relaxed">
                      {resumes[r.talent_id] ??
                        "No résumé text on their profile. Use Open résumé for the file."}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
