import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/jobs")({
  head: () => ({
    meta: [{ title: "Jobs" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminJobs,
});

type JobRow = {
  id: string;
  title: string;
  location: string | null;
  organizations: { name: string } | null;
};

function AdminJobs() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from("jobs")
      .select("id, title, location, organizations (name)")
      .order("created_at", { ascending: false });
    setJobs((data as unknown as JobRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">All job postings</h2>
      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : jobs.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No postings yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
          {jobs.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <div>{j.title}</div>
                <div className="text-xs text-muted-foreground">
                  {j.organizations?.name ?? "—"} · {j.location ?? "—"}
                </div>
              </div>
              <button
                onClick={() => remove(j.id)}
                className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
