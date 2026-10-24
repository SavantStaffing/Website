import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, label, primaryButton } from "@/components/site/ui";
import {
  needsDetails,
  recruiterDetailsSchema,
  talentDetailsSchema,
} from "@/lib/auth/profile-details";

/**
 * Asks signed-in users for the details their sign-up method didn't capture
 * (Google sign-ups, older accounts). Recruiters: point of contact + company.
 * Talent and coaches: name, phone, optional LinkedIn. Admins are never asked.
 */
export function CompleteProfileDialog() {
  const { auth, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    linkedin_url: "",
    company_name: "",
    company_website: "",
  });
  const role = auth?.role;
  const isRecruiter = role === "recruiter";

  useEffect(() => {
    if (loading || !auth || auth.role === "admin") return setOpen(false);
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: tp }, { data: u }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "first_name, last_name, phone, linkedin_url, company_name, company_website, created_at",
          )
          .eq("id", auth.userId)
          .maybeSingle(),
        supabase
          .from("talent_profiles")
          .select("first_name, last_name, linkedin_url")
          .eq("user_id", auth.userId)
          .maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (cancelled || !needsDetails(auth.role, p, tp)) return;
      // Prefill from anything we already know, including the Google profile.
      const meta = (u.user?.user_metadata ?? {}) as Record<string, string | undefined>;
      const [gFirst, ...gRest] = (meta.full_name || meta.name || "").split(" ");
      setF({
        first_name: p?.first_name || tp?.first_name || meta.given_name || gFirst || "",
        last_name: p?.last_name || tp?.last_name || meta.family_name || gRest.join(" ") || "",
        phone: p?.phone || "",
        linkedin_url: p?.linkedin_url || tp?.linkedin_url || "",
        company_name: p?.company_name || "",
        company_website: p?.company_website || "",
      });
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, loading]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!auth) return;
    const parsed = (isRecruiter ? recruiterDetailsSchema : talentDetailsSchema).safeParse(f);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    setSaving(true);
    const d = parsed.data as Record<string, string | null>;
    const { error } = await supabase
      .from("profiles")
      // `username` is a unique login handle (account_names migration); the
      // person's real name belongs in full_name.
      .update({ ...d, full_name: `${d.first_name} ${d.last_name}` })
      .eq("id", auth.userId);
    if (!error && !isRecruiter) {
      // Keep the talent profile's name in sync when one exists.
      await supabase
        .from("talent_profiles")
        .update({
          first_name: d.first_name,
          last_name: d.last_name,
          ...(d.linkedin_url ? { linkedin_url: d.linkedin_url } : {}),
        })
        .eq("user_id", auth.userId);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Thanks — your details are saved.");
    setOpen(false);
  }

  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Complete registration
        </p>
        <DialogTitle className="text-2xl font-semibold">
          {isRecruiter ? "Tell us about your company." : "A few details to finish."}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {isRecruiter
            ? "We need a point of contact and your company info to set up your recruiter account."
            : "Help us reach you about opportunities and services."}
        </DialogDescription>
        <form onSubmit={save} className="mt-2 space-y-5">
          {isRecruiter && <p className={label}>Point of contact</p>}
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name" value={f.first_name} onChange={set("first_name")} />
            <Field label="Last name" value={f.last_name} onChange={set("last_name")} />
          </div>
          {isRecruiter ? (
            <>
              <Field label="Company name" value={f.company_name} onChange={set("company_name")} />
              <Field
                label="Company website"
                value={f.company_website}
                onChange={set("company_website")}
                placeholder="https://"
              />
            </>
          ) : (
            <>
              <Field label="Phone number" type="tel" value={f.phone} onChange={set("phone")} />
              <Field
                label="LinkedIn (optional)"
                value={f.linkedin_url}
                onChange={set("linkedin_url")}
                placeholder="https://linkedin.com/in/"
              />
            </>
          )}
          <button type="submit" disabled={saving} className={`w-full ${primaryButton}`}>
            {saving ? "…" : "Save and continue"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
