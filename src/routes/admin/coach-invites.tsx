import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Badge,
  card,
  label,
  list,
  mutedButton,
  primaryButton,
  selectCls,
  timeAgo,
} from "@/components/site/ui";

export const Route = createFileRoute("/admin/coach-invites")({
  head: () => ({
    meta: [{ title: "Coach invites" }, { name: "robots", content: "noindex" }],
  }),
  component: CoachInvites,
});

type Invite = {
  id: string;
  code: string;
  label: string | null;
  max_uses: number;
  uses: number;
  expires_at: string;
  revoked: boolean;
  created_at: string;
};

const EXPIRY_DAYS = [3, 7, 14, 30, 90];

const inviteUrl = (code: string) => `${window.location.origin}/join/coach?invite=${code}`;

function stateOf(i: Invite): { text: string; tone: "good" | "muted" | "warn" } {
  if (i.revoked) return { text: "Revoked", tone: "muted" };
  if (i.uses >= i.max_uses) return { text: "Used", tone: "muted" };
  if (new Date(i.expires_at) < new Date()) return { text: "Expired", tone: "warn" };
  return { text: "Active", tone: "good" };
}

/** Invite links for the hidden career-coach sign-up page. */
function CoachInvites() {
  const { userId } = Route.useRouteContext();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [who, setWho] = useState("");
  const [days, setDays] = useState(14);
  const [uses, setUses] = useState(1);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase
      .from("coach_invites")
      .select("id, code, label, max_uses, uses, expires_at, revoked, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setInvites(data ?? []);
      });
  }, []);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(code));
      toast.success("Invite link copied.");
    } catch {
      window.prompt("Copy this invite link:", inviteUrl(code));
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const { data, error } = await supabase
      .from("coach_invites")
      .insert({
        label: who.trim() || null,
        max_uses: uses,
        expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
        created_by: userId,
      })
      .select("id, code, label, max_uses, uses, expires_at, revoked, created_at")
      .single();
    setCreating(false);
    if (error) return toast.error(error.message);
    setInvites((prev) => [data, ...(prev ?? [])]);
    setWho("");
    await copy(data.code);
  }

  async function revoke(i: Invite) {
    if (
      !window.confirm(
        `Revoke the invite${i.label ? ` for ${i.label}` : ""}? The link stops working.`,
      )
    )
      return;
    const { error } = await supabase.from("coach_invites").update({ revoked: true }).eq("id", i.id);
    if (error) return toast.error(error.message);
    setInvites((prev) => prev?.map((x) => (x.id === i.id ? { ...x, revoked: true } : x)) ?? null);
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Coach invites</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Career coaches sign up through a private page that isn't linked anywhere on the site. Create
        a link here and send it to the coach. Only a live invite makes the new account a coach;
        anyone else who finds the page can only create a talent account.
      </p>

      <form onSubmit={create} className={`mt-8 ${card}`}>
        <div className="grid gap-6 md:grid-cols-3">
          <label className="block">
            <span className={label}>For (optional)</span>
            <input
              value={who}
              onChange={(e) => setWho(e.target.value)}
              maxLength={120}
              placeholder="Coach's name"
              className="mt-2 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-2 text-base outline-none focus:border-foreground"
            />
          </label>
          <label className="block">
            <span className={label}>Expires after</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className={`mt-2 block w-full ${selectCls}`}
            >
              {EXPIRY_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Sign-ups allowed</span>
            <select
              value={uses}
              onChange={(e) => setUses(Number(e.target.value))}
              className={`mt-2 block w-full ${selectCls}`}
            >
              {[1, 2, 5, 10, 25].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "1 (one coach)" : n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" disabled={creating} className={`mt-6 ${primaryButton}`}>
          {creating ? "…" : "Create & copy link"}
        </button>
      </form>

      {!invites ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : invites.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No invites yet.</p>
      ) : (
        <ul className={`mt-8 ${list}`}>
          {invites.map((i) => {
            const st = stateOf(i);
            return (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{i.label || "Unnamed invite"}</span>
                    <Badge tone={st.tone}>{st.text}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {i.uses}/{i.max_uses} used · created {timeAgo(i.created_at)} · expires{" "}
                    {new Date(i.expires_at).toLocaleDateString()}
                  </div>
                </div>
                {st.text === "Active" && (
                  <div className="flex gap-4">
                    <button onClick={() => copy(i.code)} className={mutedButton}>
                      Copy link
                    </button>
                    <button onClick={() => revoke(i)} className={mutedButton}>
                      Revoke
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
