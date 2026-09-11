import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/admin/organizations")({
  head: () => ({
    meta: [{ title: "Organizations" }, { name: "robots", content: "noindex" }],
  }),
  component: Organizations,
});

type OrgRow = { id: string; name: string };

function Organizations() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const { data } = await supabase.from("organizations").select("id, name").order("name");
    setOrgs((data as OrgRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().trim().min(2).max(120).safeParse(name);
    if (!parsed.success) {
      toast.error("Enter a company name");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("organizations").insert({ name: parsed.data });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Organization created.");
    setName("");
    load();
  }

  return (
    <section className="space-y-12">
      <div>
        <h2 className="text-2xl font-semibold">New organization</h2>
        <form onSubmit={create} className="mt-6 flex max-w-md gap-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Company name"
            className="flex-1 border-b border-[color:var(--color-hairline)] bg-transparent py-2 text-base outline-none focus:border-foreground"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-sm bg-foreground px-5 py-2 text-[12px] font-medium uppercase tracking-[0.2em] text-background disabled:opacity-50"
          >
            {creating ? "…" : "Create"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-2xl font-semibold">All organizations</h2>
        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : orgs.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No organizations yet.</p>
        ) : (
          <ul className="mt-6 divide-y divide-[color:var(--color-hairline)] border-y border-[color:var(--color-hairline)]">
            {orgs.map((o) => (
              <li key={o.id} className="py-3">
                {o.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
