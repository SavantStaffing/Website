import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const CONTACT_TOPICS = [
  "Hiring talent",
  "Looking for work",
  "Career programs",
  "Something else",
] as const;

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name").max(120),
  email: z.string().trim().email("Enter a valid email").max(254),
  company: z.string().trim().max(160),
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(1, "Add a message").max(4000),
});

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/**
 * Emails the team about a new contact-page message via Resend. Called after
 * the message is saved to contact_messages, so a failed email never loses a
 * message — it's still on /admin/messages. The recipient is fixed server-side;
 * the caller only supplies the message itself.
 *
 * Env: RESEND_API_KEY (required), CONTACT_NOTIFY_TO (default
 * info@savantalent.com), RESEND_FROM (default Resend's shared test sender).
 */
export const notifyContactMessage = createServerFn({ method: "POST" })
  .validator(contactSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[contact] RESEND_API_KEY not set; skipping email notification");
      return { sent: false };
    }

    const rows: [string, string][] = [
      ["Name", data.name],
      ["Email", data.email],
      ["Company", data.company || "—"],
      ["Topic", data.topic],
    ];
    const html = `
      <h2 style="font-family:sans-serif">New contact message</h2>
      <table style="font-family:sans-serif;font-size:14px">
        ${rows.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#666">${k}</td><td>${escape(v)}</td></tr>`).join("")}
      </table>
      <p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap">${escape(data.message)}</p>
      <p style="font-family:sans-serif;font-size:12px;color:#666">Reply to this email to answer ${escape(data.name)} directly. All messages are on /admin/messages.</p>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Savant Staffing <onboarding@resend.dev>",
        to: [process.env.CONTACT_NOTIFY_TO || "info@savantalent.com"],
        reply_to: data.email,
        subject: `New contact message: ${data.topic} — ${data.name}`,
        html,
        text: `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${data.message}`,
      }),
    });
    if (!res.ok) {
      console.error("[contact] Resend error", res.status, await res.text());
      return { sent: false };
    }
    return { sent: true };
  });
