import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { card, label, mutedButton, primaryButton } from "@/components/site/ui";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
};

type Current = { path: string; filename: string; uploadedAt: string | null } | null;

/**
 * The talent's resume file, kept in the private "resumes" bucket under their
 * own folder. Savant Apply attaches it to the resume field on application
 * forms (autofill.server.ts hands the extension a short-lived link).
 */
export function ResumeUpload({ userId }: { userId: string }) {
  const [current, setCurrent] = useState<Current>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("talent_profiles")
      .select("resume_path, resume_filename, resume_uploaded_at")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setCurrent(
          data?.resume_path
            ? {
                path: data.resume_path,
                filename: data.resume_filename ?? "resume",
                uploadedAt: data.resume_uploaded_at,
              }
            : null,
        );
        setLoading(false);
      });
  }, [userId]);

  async function upload(file: File) {
    if (!TYPES[file.type]) return toast.error("Upload a PDF or Word document.");
    if (file.size > MAX_BYTES) return toast.error("That file is over 5 MB.");
    setBusy(true);
    const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-120) || "resume";
    const path = `${userId}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage
      .from("resumes")
      .upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(false);
      return toast.error(upErr.message);
    }
    const uploadedAt = new Date().toISOString();
    const { error } = await supabase.from("talent_profiles").upsert({
      user_id: userId,
      resume_path: path,
      resume_filename: file.name.slice(0, 200),
      resume_uploaded_at: uploadedAt,
    });
    if (error) {
      await supabase.storage.from("resumes").remove([path]);
      setBusy(false);
      return toast.error(error.message);
    }
    // One resume at a time: drop the file this one replaced.
    if (current?.path) await supabase.storage.from("resumes").remove([current.path]);
    setCurrent({ path, filename: file.name, uploadedAt });
    setBusy(false);
    toast.success("Resume uploaded. Savant Apply will attach it to applications.");
  }

  async function download() {
    if (!current) return;
    const { data, error } = await supabase.storage
      .from("resumes")
      .createSignedUrl(current.path, 60, { download: current.filename });
    if (error || !data) return toast.error(error?.message ?? "Couldn't open the file");
    window.location.assign(data.signedUrl);
  }

  async function remove() {
    if (!current) return;
    setBusy(true);
    const { error } = await supabase
      .from("talent_profiles")
      .update({ resume_path: null, resume_filename: null, resume_uploaded_at: null })
      .eq("user_id", userId);
    if (!error) await supabase.storage.from("resumes").remove([current.path]);
    setBusy(false);
    if (error) return toast.error(error.message);
    setCurrent(null);
    toast.success("Resume removed.");
  }

  return (
    <div className={`${card} max-w-2xl`}>
      <div className={label}>Resume file</div>
      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : current ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate text-base font-medium">{current.filename}</div>
            {current.uploadedAt && (
              <div className="text-xs text-muted-foreground">
                Uploaded {new Date(current.uploadedAt).toLocaleDateString()}
              </div>
            )}
          </div>
          <div className="flex items-center gap-5">
            <button type="button" onClick={download} className={mutedButton}>
              Download
            </button>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className={mutedButton}
            >
              Replace
            </button>
            <button type="button" onClick={remove} disabled={busy} className={mutedButton}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-md text-sm text-muted-foreground">
            Upload your resume once and Savant Apply attaches it to application forms for you. PDF
            or Word, up to 5 MB.
          </p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className={primaryButton}
          >
            {busy ? "Uploading…" : "Upload resume"}
          </button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload(file);
        }}
      />
      <p className="mt-4 text-xs text-muted-foreground">
        Private to you. Only you and Savant Apply, while filling an application you started, can
        open it.
      </p>
    </div>
  );
}
