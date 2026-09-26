import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  Field,
  TextArea,
  label,
  outlineButton,
  primaryButton,
  selectCls,
} from "@/components/site/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { SERVICES, type ServiceId } from "@/lib/services";

const schema = z.object({
  goals: z
    .string()
    .trim()
    .min(10, "Tell the coach a little about what you want (a sentence or two).")
    .max(2000),
  availability: z.string().trim().max(300),
  contact_method: z.enum(["email", "phone"]),
  phone: z.string().trim().max(30),
  program: z.string().trim().max(120),
});

/**
 * Sign-up for one Preparation service. Talent submit a request; guests are
 * sent to create an account; other roles see nothing (they can't sign up).
 */
export function ServiceSignupForm({
  service,
  defaultProgram = "",
}: {
  service: ServiceId;
  /** Pre-selects the program (from a career program's own page). */
  defaultProgram?: string;
}) {
  const { auth, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    goals: "",
    availability: "",
    contact_method: "email" as "email" | "phone",
    phone: "",
    program: defaultProgram,
  });
  const def = SERVICES.find((s) => s.id === service)!;
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (loading) return null;

  if (!auth) {
    return (
      <Link
        to="/auth"
        search={{ mode: "signup", next: `/preparation#${def.anchor}` } as never}
        className={outlineButton}
      >
        Create a talent account to sign up
      </Link>
    );
  }
  if (auth.role !== "talent") return null;

  if (sent) {
    return (
      <p className="text-sm">
        You're signed up for {def.title}. A career coach will be in touch — track it on your{" "}
        <Link to="/talent" className="underline underline-offset-4">
          dashboard
        </Link>
        .
      </p>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={primaryButton}>
        Sign up for {def.title}
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Check the form");
    const d = parsed.data;
    if (d.contact_method === "phone" && !d.phone)
      return toast.error("Add a phone number, or choose email.");
    setSending(true);
    const { error } = await supabase.from("service_requests").insert({
      talent_id: auth!.userId,
      service,
      program: d.program || null,
      goals: d.goals,
      availability: d.availability || null,
      contact_method: d.contact_method,
      phone: d.contact_method === "phone" ? d.phone : null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success(`Signed up for ${def.title}.`);
  }

  return (
    <form
      onSubmit={submit}
      className="max-w-2xl space-y-6 border border-[color:var(--color-hairline)] p-6"
    >
      <div className="text-lg font-medium">Sign up for {def.title}</div>
      {def.items.length > 0 && (
        <label className="block">
          <span className={label}>Program</span>
          <select
            value={form.program}
            onChange={(e) => set("program")(e.target.value)}
            className={`mt-2 block w-full ${selectCls}`}
          >
            <option value="">Not sure yet — help me choose</option>
            {def.items.map((i) => (
              <option key={i.name} value={i.name}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <TextArea
        label="What do you want to get out of it?"
        rows={4}
        value={form.goals}
        onChange={set("goals")}
        placeholder="e.g. I'm moving from retail into logistics and need a resume that shows transferable skills."
      />
      <Field
        label="When are you available? (optional)"
        value={form.availability}
        onChange={set("availability")}
        placeholder="Weekday evenings, Saturday mornings…"
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Best way to reach you</span>
          <select
            value={form.contact_method}
            onChange={(e) => set("contact_method")(e.target.value)}
            className={`mt-2 block w-full ${selectCls}`}
          >
            <option value="email">Email ({auth.email})</option>
            <option value="phone">Phone</option>
          </select>
        </label>
        {form.contact_method === "phone" && (
          <Field label="Phone" type="tel" value={form.phone} onChange={set("phone")} />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <button type="submit" disabled={sending} className={primaryButton}>
          {sending ? "…" : "Submit sign-up"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
