import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/recruiter/jobs")({
  head: () => ({
    meta: [{ title: "Manage Jobs" }, { name: "robots", content: "noindex" }],
  }),
  component: RecruiterJobs,
});

type JobRow = {
  id: string;
  title: string;
  location: string | null;
  type: string | null;
  created_at: string;
};

const schema = z.object({
  title: z.string().trim().min(2).max(120),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  type: z.string().trim().max(60).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
});

function RecruiterJobs() {
  const { userId, profile } = Route.useRouteContext();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [posting, setPosting] = useState(false);

  async function loadJobs() {
    if (!profile.organizationId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("jobs")
      .select("id, title, location, type, created_at")
      .eq("organization_id", profile.organizationId)
      .order("created_at", { ascending: false });
    setJobs((data as JobRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadJobs();
  }, [profile.organizationId]);

  if (!profile.organizationId) {
    return (
      <div className="rounded-sm border border-[color:var(--color-hairline)] p-6">
        <p className="text-sm text-muted-foreground">
          Your account isn't linked to an organization yet, so you can't post jobs. Contact your
          Savant admin.
        </p>
      </div>
    );
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ title, location, type, description });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setPosting(true);
    const { error } = await supabase.from("jobs").insert({
      posted_by: userId,
      organization_id: profile.organizationId!,
      title: parsed.data.title,
      location: parsed.data.location || null,
      type: parsed.data.type || null,
      description: parsed.data.description || null,
    });
    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Job posted.");
    setTitle("");
    setLocation("");
    setType("");
    setDescription("");
    loadJobs();
  }

  return (
    <section className="space-y-12">
      <div>
        <h2 className="text-2xl font-semibold">Post a job</h2>
        <form onSubmit={post} className="mt-8 max-w-lg space-y-5">
          <Field label="Title" value={title} onChange={setTitle} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Location" value={location} onChange={setLocation} />
            <Field
              label="Type"
              value={type}
              onChange={setType}
              placeholder="Full-time, Contract…"
            />
          </div>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="mt-2 block w-full rounded-sm border border-[color:var(--color-hairline)] bg-transparent p-3 text-sm outline-none focus:border-foreground"
            />
          </label>
          <button
            type="submit"
            disabled={posting}
            className="rounded-sm bg-foreground px-6 py-3 text-[12px] font-medium uppercase tracking-[0.2em] text-background disabled:opacity-50"
          >
            {posting ? "…" : "Post job"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-2xl font-semibold">Your organization's postings</h2>
        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No postings yet.</p>
        ) : (
          <ul className="mt-6 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
            {jobs.map((j) => (
              <li key={j.id} className="py-5">
                <div className="text-lg font-medium">{j.title}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                  {j.location ?? "—"} · {j.type ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-3 text-base outline-none focus:border-foreground"
      />
    </label>
  );
}
