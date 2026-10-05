import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { list, mutedButton, outlineButton, timeAgo } from "@/components/site/ui";
import {
  APPLICATION_SELECT,
  TALENT_STATUS_LABEL,
  type TalentApplication,
} from "@/lib/applications";
import { addApplicationByUrl } from "@/lib/applications.functions";

export const Route = createFileRoute("/talent/applications")({
  head: () => ({
    meta: [{ title: "Your Applications" }, { name: "robots", content: "noindex" }],
  }),
  component: Applications,
});

type ApplicationRow = TalentApplication;
const SELECT = APPLICATION_SELECT;

function Applications() {
  const { userId } = Route.useRouteContext();
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("job_applications")
        .select(SELECT)
        .eq("applicant_id", userId)
        .order("created_at", { ascending: false });
      setApplications((data as unknown as ApplicationRow[]) ?? []);
      setLoading(false);
    })();
  }, [userId]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const value = url.trim();
    if (!value) return;
    setAdding(true);
    try {
      const res = await addApplicationByUrl({
        data: { url: /^https?:\/\//i.test(value) ? value : `https://${value}` },
      });
      if (!res.ok) return toast.error(res.error);
      setApplications((prev) => [res.application, ...prev]);
      setShowArchived(false);
      setUrl("");
      toast.success(
        res.detailsFound
          ? "Added to your applications."
          : "Added. We couldn't read the job title from that page, so it's listed by its link.",
      );
    } catch {
      toast.error("That doesn't look like a job link. Paste the full web address.");
    } finally {
      setAdding(false);
    }
  }

  async function setArchived(id: string, archived: boolean) {
    const { error } = await supabase.rpc("set_application_archived", {
      application_id: id,
      archived,
    });
    if (error) return toast.error(error.message);
    setApplications((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, archived_at: archived ? new Date().toISOString() : null } : a,
      ),
    );
  }

  async function complete(id: string) {
    const { error } = await supabase.rpc("mark_application_completed", { application_id: id });
    if (error) return toast.error(error.message);
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: "submitted" } : a)));
    toast.success("Marked as completed.");
  }

  async function remove(a: ApplicationRow) {
    const message = a.jobs
      ? "Delete this application? If you applied through Savant, this withdraws it."
      : "Delete this application from your list?";
    if (!window.confirm(message)) return;
    const { error } = await supabase.from("job_applications").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    setApplications((prev) => prev.filter((x) => x.id !== a.id));
  }

  const archivedCount = applications.filter((a) => a.archived_at).length;
  const visible = applications.filter((a) => !!a.archived_at === showArchived);

  return (
    <section>
      <h2 className="text-2xl font-semibold">Your applications</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Roles you've applied to through Savant, applications you started on a company's own site,
        and jobs you've added by link.
      </p>

      <form onSubmit={add} className="mt-8 flex flex-wrap items-end gap-4">
        <label className="block min-w-0 flex-1 basis-72">
          <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Add a job by link
          </span>
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://company.com/careers/job-posting"
            className="mt-2 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-3 text-base outline-none focus:border-foreground"
          />
        </label>
        <button type="submit" disabled={adding || !url.trim()} className={outlineButton}>
          {adding ? "Adding…" : "Add"}
        </button>
      </form>

      {archivedCount > 0 && (
        <div className="mt-8 flex gap-6">
          <button
            onClick={() => setShowArchived(false)}
            className={`${mutedButton} ${showArchived ? "" : "text-foreground underline underline-offset-4"}`}
          >
            Active ({applications.length - archivedCount})
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`${mutedButton} ${showArchived ? "text-foreground underline underline-offset-4" : ""}`}
          >
            Archived ({archivedCount})
          </button>
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="mt-8 rounded-sm border border-[color:var(--color-hairline)] p-6">
          <p className="text-sm text-muted-foreground">
            {showArchived ? (
              "Nothing archived."
            ) : (
              <>
                No applications yet. Paste a job link above, or{" "}
                <Link to="/talent/jobs" className="text-foreground underline underline-offset-4">
                  browse your job feed
                </Link>
                .
              </>
            )}
          </p>
        </div>
      ) : (
        <ul className={`mt-6 ${list}`}>
          {visible.map((a) => {
            const link = a.external_url ?? a.jobs?.apply_url;
            return (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-4 py-6">
                <div className="min-w-0">
                  <div className="text-lg font-medium">
                    {a.jobs?.title ?? a.external_title ?? "Untitled role"}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                    {(a.jobs
                      ? [a.jobs.company_name, a.jobs.location, a.jobs.type]
                      : [a.external_company, a.external_location]
                    )
                      .filter(Boolean)
                      .join(" · ") || "—"}{" "}
                    · {timeAgo(a.created_at)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {TALENT_STATUS_LABEL[a.status] ?? a.status}
                  </span>
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={mutedButton}
                    >
                      Visit ↗
                    </a>
                  )}
                  {(a.status === "tracked" || a.status === "started") && (
                    <button onClick={() => complete(a.id)} className={mutedButton}>
                      Completed
                    </button>
                  )}
                  <button onClick={() => setArchived(a.id, !a.archived_at)} className={mutedButton}>
                    {a.archived_at ? "Restore" : "Archive"}
                  </button>
                  <button onClick={() => remove(a)} className={mutedButton}>
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
