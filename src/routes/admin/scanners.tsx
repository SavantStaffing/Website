import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge, list, selectCls, timeAgo } from "@/components/site/ui";

export const Route = createFileRoute("/admin/scanners")({
  head: () => ({
    meta: [{ title: "Unique scanners" }, { name: "robots", content: "noindex" }],
  }),
  component: UniqueScanners,
});

type Site = {
  id: string;
  name: string;
  site_url: string;
  jobs_url: string | null;
  platform: string | null;
  reason: string;
  status: string;
  notes: string | null;
  last_checked_at: string;
};

const STATUSES = [
  { value: "needs_scanner", label: "Needs scanner", tone: "warn" },
  { value: "in_progress", label: "In progress", tone: "muted" },
  { value: "supported", label: "Supported", tone: "good" },
  { value: "wont_build", label: "Won't build", tone: "muted" },
] as const;

/** Careers sites the Job Scout can't read yet; the scout adds them itself. */
function UniqueScanners() {
  const [sites, setSites] = useState<Site[] | null>(null);

  useEffect(() => {
    supabase
      .from("unique_scanner_sites")
      .select("id, name, site_url, jobs_url, platform, reason, status, notes, last_checked_at")
      .order("status")
      .order("name")
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setSites(data ?? []);
      });
  }, []);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("unique_scanner_sites").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setSites((prev) => prev?.map((s) => (s.id === id ? { ...s, status } : s)) ?? null);
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Unique scanners</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Careers sites the Job Scout can't read: no supported ATS, no job markup and no job sitemap.
        Scans add them here automatically, naming the platform when it's recognized. A site that
        starts working again is marked Supported on its next scan.
      </p>
      {!sites ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : sites.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Every scanned site is readable.</p>
      ) : (
        <ul className={`mt-8 ${list}`}>
          {sites.map((s) => {
            const st = STATUSES.find((x) => x.value === s.status) ?? STATUSES[0];
            return (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-4 py-5">
                <div className="min-w-0 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={s.site_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium [@media(hover:hover)]:hover:underline"
                    >
                      {s.name}
                    </a>
                    {s.platform && <Badge>{s.platform}</Badge>}
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{s.reason}</p>
                  {s.notes && <p className="mt-1 text-xs text-muted-foreground">{s.notes}</p>}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {s.jobs_url && (
                      <>
                        <a
                          href={s.jobs_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-4"
                        >
                          Job list
                        </a>{" "}
                        ·{" "}
                      </>
                    )}
                    Checked {timeAgo(s.last_checked_at)}
                  </div>
                </div>
                <select
                  value={s.status}
                  onChange={(e) => setStatus(s.id, e.target.value)}
                  className={selectCls}
                  aria-label={`Status for ${s.name}`}
                >
                  {STATUSES.map((x) => (
                    <option key={x.value} value={x.value}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
