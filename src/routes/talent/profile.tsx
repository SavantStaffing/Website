import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/talent/profile")({
  head: () => ({
    meta: [{ title: "Your Profile" }, { name: "robots", content: "noindex" }],
  }),
  component: Profile,
});

const schema = z.object({
  username: z.string().trim().min(2).max(40),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

function Profile() {
  const { userId, email: authEmail } = Route.useRouteContext();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(authEmail ?? "");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, email, phone")
        .eq("id", userId)
        .maybeSingle();
      if (data) {
        setUsername(data.username ?? "");
        setEmail(data.email ?? authEmail ?? "");
        setPhone(data.phone ?? "");
      }
      setInitial(false);
    })();
  }, [userId, authEmail]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ username, email, phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        username: parsed.data.username,
        phone: parsed.data.phone || null,
        email: parsed.data.email,
      })
      .eq("id", userId);
    let emailError = null;
    if (parsed.data.email !== authEmail) {
      const { error } = await supabase.auth.updateUser({ email: parsed.data.email });
      emailError = error;
    }
    setLoading(false);
    if (profileError || emailError) {
      toast.error(profileError?.message ?? emailError?.message ?? "Save failed");
      return;
    }
    toast.success("Saved.");
  }

  if (initial) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <section>
      <h2 className="text-2xl font-semibold">Your profile</h2>
      <form onSubmit={save} className="mt-8 max-w-md space-y-6">
        <Field label="Username" value={username} onChange={setUsername} />
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Phone" type="tel" value={phone} onChange={setPhone} />
        <button
          type="submit"
          disabled={loading}
          className="rounded-sm bg-foreground px-6 py-3 text-[12px] font-medium uppercase tracking-[0.2em] text-background disabled:opacity-50"
        >
          {loading ? "…" : "Save changes"}
        </button>
      </form>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 block w-full border-b border-[color:var(--color-hairline)] bg-transparent py-3 text-base outline-none focus:border-foreground"
      />
    </label>
  );
}
