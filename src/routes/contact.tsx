import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, TextArea, label, primaryButton, selectCls } from "@/components/site/ui";
import {
  CONTACT_TOPICS as TOPICS,
  contactSchema as schema,
  notifyContactMessage,
} from "@/lib/contact.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Savant Staffing" },
      {
        name: "description",
        content: "Talk to Savant Staffing about hiring, finding work, or our programs.",
      },
    ],
  }),
  component: Contact,
});

function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    topic: TOPICS[0] as string,
    message: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Check the form");
    setSending(true);
    const { error } = await supabase.from("contact_messages").insert({
      ...parsed.data,
      company: parsed.data.company || null,
    });
    setSending(false);
    if (error) return toast.error("We couldn't send that. Email info@savantalent.com instead.");
    setSent(true);
    // The message is already saved; the email alert is best-effort.
    notifyContactMessage({ data: parsed.data }).catch(() => {});
  }

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Contact</p>
      <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">Let's talk.</h1>
      <div className="mt-16 grid gap-16 md:grid-cols-[1fr_2fr]">
        <div className="space-y-8 text-sm">
          <div>
            <div className={label}>Email</div>
            <a href="mailto:info@savantalent.com" className="mt-2 block">
              info@savantalent.com
            </a>
          </div>
          <p className="text-muted-foreground">
            Hiring? Tell us about the role and we'll come back within one business day. Looking for
            work? The fastest route is to create a talent account — our recruiters search it daily.
          </p>
        </div>

        {sent ? (
          <div className="border border-[color:var(--color-hairline)] p-8">
            <div className="text-2xl font-medium">Thanks — message received.</div>
            <p className="mt-3 text-sm text-muted-foreground">
              Someone from Savant will reply to {form.email}.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Name" value={form.name} onChange={set("name")} />
              <Field label="Email" type="email" value={form.email} onChange={set("email")} />
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Company (optional)" value={form.company} onChange={set("company")} />
              <label className="block">
                <span className={label}>Topic</span>
                <select
                  value={form.topic}
                  onChange={(e) => set("topic")(e.target.value)}
                  className={`mt-2 block w-full ${selectCls}`}
                >
                  {TOPICS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <TextArea label="Message" rows={6} value={form.message} onChange={set("message")} />
            <button type="submit" disabled={sending} className={primaryButton}>
              {sending ? "…" : "Send message"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
