import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Field, TextArea, card, label, primaryButton, selectCls } from "@/components/site/ui";
import { NAICS_SECTOR_OPTIONS } from "@/lib/scout/refine";

export const Route = createFileRoute("/recruiter/company")({
  head: () => ({
    meta: [{ title: "Company" }, { name: "robots", content: "noindex" }],
  }),
  component: Company,
});

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  website: z
    .string()
    .trim()
    .url("Website must be a full URL")
    .max(300)
    .optional()
    .or(z.literal("")),
  industry: z.string().trim().max(120),
  naics_code: z.string().trim().max(10),
  description: z.string().trim().max(4000),
});

/** Company info — editable by the org's owner/manager, read-only for everyone else. */
function Company() {
  const { userId, profile } = Route.useRouteContext();
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [form, setForm] = useState({
    name: "",
    website: "",
    industry: "",
    naics_code: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile.organizationId) return setLoading(false);
    (async () => {
      const [{ data: org }, { data: me }] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", profile.organizationId!).maybeSingle(),
        supabase.from("profiles").select("org_permission").eq("id", userId).maybeSingle(),
      ]);
      if (org)
        setForm({
          name: org.name,
          website: org.website ?? "",
          industry: org.industry ?? "",
          naics_code: org.naics_code ?? "",
          description: org.description ?? "",
        });
      setCanEdit(me?.org_permission === "owner" || me?.org_permission === "manager");
      setLoading(false);
    })();
  }, [profile.organizationId, userId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    setSaving(true);
    const d = parsed.data;
    const { error } = await supabase
      .from("organizations")
      .update({
        name: d.name,
        website: d.website || null,
        industry: d.industry || null,
        naics_code: d.naics_code || null,
        description: d.description || null,
      })
      .eq("id", profile.organizationId!);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Company info saved.");
  }

  if (!profile.organizationId) {
    return (
      <div className={card}>
        <p className="text-sm text-muted-foreground">
          Your account isn't linked to an organization yet. Contact your Savant admin to be assigned
          to a company.
        </p>
      </div>
    );
  }
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (!canEdit) {
    return (
      <section>
        <h2 className="text-2xl font-semibold">{form.name}</h2>
        <dl className="mt-8 grid max-w-2xl gap-6 sm:grid-cols-2">
          {[
            ["Website", form.website],
            ["Industry", form.industry],
            ["NAICS", form.naics_code],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className={label}>{k}</dt>
              <dd className="mt-2">{v || "—"}</dd>
            </div>
          ))}
        </dl>
        {form.description && (
          <p className="mt-8 max-w-2xl whitespace-pre-line text-sm">{form.description}</p>
        )}
        <p className="mt-10 text-xs text-muted-foreground">
          Only your organization's owner or a manager can edit company info.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Company info</h2>
      <form onSubmit={save} className="mt-8 max-w-2xl space-y-6">
        <Field label="Company name" value={form.name} onChange={set("name")} />
        <Field
          label="Website"
          value={form.website}
          onChange={set("website")}
          placeholder="https://"
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Industry" value={form.industry} onChange={set("industry")} />
          <label className="block">
            <span className={label}>NAICS sector</span>
            <select
              value={form.naics_code}
              onChange={(e) => {
                const o = NAICS_SECTOR_OPTIONS.find((x) => x.code === e.target.value);
                setForm((f) => ({
                  ...f,
                  naics_code: e.target.value,
                  industry: f.industry || o?.label || "",
                }));
              }}
              className={`mt-2 block w-full ${selectCls}`}
            >
              <option value="">Not set</option>
              {NAICS_SECTOR_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.code} — {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <TextArea
          label="About the company"
          value={form.description}
          onChange={set("description")}
        />
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving ? "…" : "Save company info"}
        </button>
      </form>
    </section>
  );
}
