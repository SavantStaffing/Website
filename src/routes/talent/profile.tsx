import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ResumeUpload } from "@/components/talent/ResumeUpload";
import { SavedAnswers } from "@/components/talent/SavedAnswers";
import {
  Field,
  TagInput,
  TextArea,
  Toggle,
  label,
  mutedButton,
  primaryButton,
  selectCls,
} from "@/components/site/ui";

export const Route = createFileRoute("/talent/profile")({
  head: () => ({
    meta: [{ title: "Talent Profile" }, { name: "robots", content: "noindex" }],
  }),
  component: Profile,
});

const contactSchema = z.object({
  username: z.string().trim().min(2, "Username must be at least 2 characters").max(40),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

const url = z
  .string()
  .trim()
  .url("Links must be full URLs (https://…)")
  .max(500)
  .optional()
  .or(z.literal(""));
const professionalSchema = z.object({
  first_name: z.string().trim().max(80),
  last_name: z.string().trim().max(80),
  headline: z.string().trim().max(160),
  location: z.string().trim().max(120),
  current_title: z.string().trim().max(120),
  current_company: z.string().trim().max(120),
  linkedin_url: url,
  github_url: url,
  portfolio_url: url,
  salary_expectation: z.string().trim().max(80),
  earliest_start: z.string().trim().max(80),
  resume_text: z.string().max(60000),
});

type Professional = { [K in keyof z.infer<typeof professionalSchema>]-?: string };
const EMPTY: Professional = {
  first_name: "",
  last_name: "",
  headline: "",
  location: "",
  current_title: "",
  current_company: "",
  linkedin_url: "",
  github_url: "",
  portfolio_url: "",
  salary_expectation: "",
  earliest_start: "",
  resume_text: "",
};

type TriState = "" | "yes" | "no";
const toTri = (b: boolean | null | undefined): TriState =>
  b === true ? "yes" : b === false ? "no" : "";
const fromTri = (t: TriState) => (t === "yes" ? true : t === "no" ? false : null);

function Profile() {
  const { userId, email: authEmail } = Route.useRouteContext();
  const [initial, setInitial] = useState(true);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(authEmail ?? "");
  const [phone, setPhone] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  const [pro, setPro] = useState<Professional>(EMPTY);
  const [skills, setSkills] = useState<string[]>([]);
  const [workAuthorized, setWorkAuthorized] = useState<TriState>("");
  const [needsSponsorship, setNeedsSponsorship] = useState<TriState>("");
  const [visible, setVisible] = useState(true);
  const [savingPro, setSavingPro] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: base }, { data: tp }] = await Promise.all([
        supabase.from("profiles").select("username, email, phone").eq("id", userId).maybeSingle(),
        supabase.from("talent_profiles").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      if (base) {
        setUsername(base.username ?? "");
        setEmail(base.email ?? authEmail ?? "");
        setPhone(base.phone ?? "");
      }
      if (tp) {
        setPro(
          Object.fromEntries(
            Object.keys(EMPTY).map((k) => [k, (tp as Record<string, unknown>)[k] ?? ""]),
          ) as Professional,
        );
        setSkills(tp.skills ?? []);
        setWorkAuthorized(toTri(tp.work_authorized));
        setNeedsSponsorship(toTri(tp.needs_sponsorship));
        setVisible(tp.visible_to_recruiters);
      }
      setInitial(false);
    })();
  }, [userId, authEmail]);

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    const parsed = contactSchema.safeParse({ username, email, phone });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    setSavingContact(true);
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
    setSavingContact(false);
    if (profileError || emailError)
      return toast.error(profileError?.message ?? emailError?.message ?? "Save failed");
    toast.success(
      parsed.data.email !== authEmail
        ? "Saved. Check your inbox to confirm the new email."
        : "Saved.",
    );
  }

  async function savePro(e: React.FormEvent) {
    e.preventDefault();
    const parsed = professionalSchema.safeParse(pro);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    setSavingPro(true);
    const blankToNull = Object.fromEntries(
      Object.entries(parsed.data).map(([k, v]) => [k, v === "" ? null : v]),
    );
    const { error } = await supabase.from("talent_profiles").upsert({
      ...blankToNull,
      user_id: userId,
      skills,
      work_authorized: fromTri(workAuthorized),
      needs_sponsorship: fromTri(needsSponsorship),
      visible_to_recruiters: visible,
    });
    setSavingPro(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved.");
  }

  if (initial) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const set = (k: keyof Professional) => (v: string) => setPro((p) => ({ ...p, [k]: v }));

  return (
    <section className="space-y-16">
      <div>
        <h1 className="text-3xl font-semibold">Talent Profile</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Your résumé, profile and saved answers in one place. Recruiters see your profile, and
          Savant Apply uses all three to fill in applications for you.
        </p>
        <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          {[
            ["#resume", "Resume"],
            ["#professional-profile", "Professional profile"],
            ["#saved-answers", "Saved answers"],
            ["#contact", "Contact info"],
          ].map(([href, text]) => (
            <a key={href} href={href} className={mutedButton}>
              {text}
            </a>
          ))}
        </nav>
      </div>

      <div id="resume" className="scroll-mt-24">
        <h2 className="text-2xl font-semibold">Resume</h2>
        <div className="mt-8">
          <ResumeUpload userId={userId} />
        </div>
      </div>

      <div id="professional-profile" className="scroll-mt-24">
        <h2 className="text-2xl font-semibold">Professional profile</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Recruiters see this in their talent feed (unless you hide it), and Savant Apply uses it to
          fill in application forms for you. Demographic questions are never filled automatically.
        </p>
        <form onSubmit={savePro} className="mt-8 max-w-2xl space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="First name" value={pro.first_name} onChange={set("first_name")} />
            <Field label="Last name" value={pro.last_name} onChange={set("last_name")} />
          </div>
          <Field
            label="Headline"
            value={pro.headline}
            onChange={set("headline")}
            placeholder="Certified forklift operator, 6 years in distribution"
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="Current title"
              value={pro.current_title}
              onChange={set("current_title")}
            />
            <Field
              label="Current company"
              value={pro.current_company}
              onChange={set("current_company")}
            />
          </div>
          <Field
            label="Location"
            value={pro.location}
            onChange={set("location")}
            placeholder="Atlanta, GA"
          />
          <TagInput
            label="Skills"
            value={skills}
            onChange={setSkills}
            placeholder="Type a skill and press Enter"
          />
          <div className="grid gap-6 sm:grid-cols-3">
            <Field label="LinkedIn" value={pro.linkedin_url} onChange={set("linkedin_url")} />
            <Field label="GitHub" value={pro.github_url} onChange={set("github_url")} />
            <Field label="Portfolio" value={pro.portfolio_url} onChange={set("portfolio_url")} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <TriSelect
              label="Authorized to work in the US?"
              value={workAuthorized}
              onChange={setWorkAuthorized}
            />
            <TriSelect
              label="Need visa sponsorship?"
              value={needsSponsorship}
              onChange={setNeedsSponsorship}
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="Salary expectation"
              value={pro.salary_expectation}
              onChange={set("salary_expectation")}
            />
            <Field
              label="Earliest start"
              value={pro.earliest_start}
              onChange={set("earliest_start")}
              placeholder="Two weeks' notice"
            />
          </div>
          <TextArea
            label="Resume (plain text)"
            rows={10}
            value={pro.resume_text}
            onChange={set("resume_text")}
            placeholder="Paste your resume's text. It's used to draft answers to open-ended application questions — you always review before submitting. (The file you upload above is what gets attached.)"
          />
          <Toggle
            checked={visible}
            onChange={setVisible}
            label="Visible to recruiters"
            description="Recruiters can find you in their talent feed and invite you to apply. Your email and phone stay private until you accept an invitation."
          />
          <button type="submit" disabled={savingPro} className={primaryButton}>
            {savingPro ? "…" : "Save profile"}
          </button>
        </form>
      </div>
      <SavedAnswers userId={userId} />

      <div id="contact" className="scroll-mt-24">
        <h2 className="text-2xl font-semibold">Contact info</h2>
        <form onSubmit={saveContact} className="mt-8 max-w-md space-y-6">
          <Field label="Username" value={username} onChange={setUsername} />
          <Field label="Email" type="email" value={email} onChange={setEmail} />
          <Field label="Phone" type="tel" value={phone} onChange={setPhone} />
          <button type="submit" disabled={savingContact} className={primaryButton}>
            {savingContact ? "…" : "Save contact info"}
          </button>
        </form>
      </div>
    </section>
  );
}

function TriSelect({
  label: text,
  value,
  onChange,
}: {
  label: string;
  value: TriState;
  onChange: (v: TriState) => void;
}) {
  return (
    <label className="block">
      <span className={label}>{text}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TriState)}
        className={`mt-2 block ${selectCls}`}
      >
        <option value="">Ask me each time</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
  );
}
