import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AccountSettings } from "@/components/site/AccountSettings";
import { Field, label, list, primaryButton, selectCls } from "@/components/site/ui";

export const Route = createFileRoute("/recruiter/account")({
  head: () => ({
    meta: [{ title: "Account" }, { name: "robots", content: "noindex" }],
  }),
  component: RecruiterAccount,
});

const PERMISSIONS = [
  { value: "owner", label: "Owner", help: "Everything, including team permissions" },
  { value: "manager", label: "Manager", help: "Edit company info, post and manage jobs" },
  { value: "member", label: "Member", help: "Post and manage jobs, invite talent" },
  { value: "viewer", label: "Viewer", help: "Read-only; can't edit company info" },
] as const;

const contactSchema = z.object({
  username: z.string().trim().min(2).max(40),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

type Teammate = {
  id: string;
  username: string | null;
  email: string | null;
  org_permission: string;
};

/** Account Info: contact info + Permissions (grant: point of contact / levels; deny: company info). */
function RecruiterAccount() {
  const { userId, profile } = Route.useRouteContext();
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [team, setTeam] = useState<Teammate[]>([]);
  const [contactId, setContactId] = useState<string>("");
  const [myPermission, setMyPermission] = useState<string>("member");

  useEffect(() => {
    (async () => {
      const [{ data: me }, { data: teammates }, { data: org }] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, phone, org_permission")
          .eq("id", userId)
          .maybeSingle(),
        profile.organizationId
          ? supabase
              .from("profiles")
              .select("id, username, email, org_permission")
              .eq("organization_id", profile.organizationId)
              .order("created_at")
          : Promise.resolve({ data: [] as Teammate[] }),
        profile.organizationId
          ? supabase
              .from("organizations")
              .select("point_of_contact_id")
              .eq("id", profile.organizationId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setUsername(me?.username ?? "");
      setPhone(me?.phone ?? "");
      setMyPermission(me?.org_permission ?? "member");
      setTeam(teammates ?? []);
      setContactId(org?.point_of_contact_id ?? "");
    })();
  }, [userId, profile.organizationId]);

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    const parsed = contactSchema.safeParse({ username, phone });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    setSavingContact(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: parsed.data.username, phone: parsed.data.phone || null })
      .eq("id", userId);
    setSavingContact(false);
    if (error) return toast.error(error.message);
    toast.success("Saved.");
  }

  async function changePermission(target: string, permission: string) {
    const { error } = await supabase.rpc("set_org_permission", {
      _target: target,
      _permission: permission,
    });
    if (error) return toast.error(error.message);
    setTeam((prev) =>
      prev.map((t) => (t.id === target ? { ...t, org_permission: permission } : t)),
    );
    toast.success("Permission updated.");
  }

  async function changeContact(id: string) {
    const prev = contactId;
    setContactId(id);
    const { error } = await supabase
      .from("organizations")
      .update({ point_of_contact_id: id || null })
      .eq("id", profile.organizationId!);
    if (error) {
      setContactId(prev);
      toast.error(error.message);
    } else toast.success("Point of contact updated.");
  }

  const isOwner = myPermission === "owner";
  const canEditOrg = isOwner || myPermission === "manager";

  return (
    <div className="space-y-16">
      <section>
        <h2 className="text-2xl font-semibold">Contact info</h2>
        <form onSubmit={saveContact} className="mt-8 max-w-md space-y-6">
          <Field label="Name" value={username} onChange={setUsername} />
          <Field label="Phone" type="tel" value={phone} onChange={setPhone} />
          <button type="submit" disabled={savingContact} className={primaryButton}>
            {savingContact ? "…" : "Save"}
          </button>
        </form>
      </section>

      {profile.organizationId && (
        <section>
          <h2 className="text-2xl font-semibold">Permissions</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Your level: <strong className="text-foreground">{myPermission}</strong>.{" "}
            {isOwner
              ? "As the owner you can change everyone's access."
              : "Only your organization's owner can change access levels."}
          </p>

          <label className="mt-8 block max-w-md">
            <span className={label}>Point of contact</span>
            <select
              value={contactId}
              disabled={!canEditOrg}
              onChange={(e) => changeContact(e.target.value)}
              className={`mt-2 block w-full ${selectCls}`}
            >
              <option value="">Not set</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.username ?? t.email}
                </option>
              ))}
            </select>
          </label>

          <ul className={`mt-8 ${list}`}>
            {team.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <div>
                    {t.username ?? "—"}{" "}
                    {t.id === userId && (
                      <span className="text-xs text-muted-foreground">(you)</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{t.email}</div>
                </div>
                <select
                  value={t.org_permission}
                  disabled={!isOwner || t.id === userId}
                  onChange={(e) => changePermission(t.id, e.target.value)}
                  className={selectCls}
                  title={PERMISSIONS.find((p) => p.value === t.org_permission)?.help}
                >
                  {PERMISSIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <dl className="mt-6 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            {PERMISSIONS.map((p) => (
              <div key={p.value}>
                <dt className="inline font-medium text-foreground">{p.label}:</dt>{" "}
                <dd className="inline">{p.help}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <AccountSettings userId={userId} />
    </div>
  );
}
