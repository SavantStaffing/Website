import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Empty,
  SectionHeading,
  Toggle,
  card,
  label,
  linkButton,
  list,
  mutedButton,
  timeAgo,
} from "@/components/site/ui";
import { getAlwaysAutofill, setAlwaysAutofill, useSavantApply } from "@/lib/autofill/extension";

export const Route = createFileRoute("/talent/answers")({
  head: () => ({
    meta: [{ title: "Saved answers" }, { name: "robots", content: "noindex" }],
  }),
  component: SavedAnswers,
});

type Answer = {
  id: string;
  question_key: string;
  question_label: string | null;
  answer: string;
  updated_at: string;
};

// Answers saved before labels were kept only have the normalized key.
const questionOf = (a: Answer) =>
  a.question_label || a.question_key.charAt(0).toUpperCase() + a.question_key.slice(1);

/**
 * Answers Savant Apply remembered from applications the talent submitted, and
 * reuses when another form asks the same question. Demographic answers are
 * never saved, so they never appear here.
 */
function SavedAnswers() {
  const { userId } = Route.useRouteContext();
  const [rows, setRows] = useState<Answer[] | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("saved_answers")
      .select("id, question_key, question_label, answer, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setRows(data ?? []);
      });
  }, [userId]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter(
      (a) => !needle || `${questionOf(a)} ${a.answer}`.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  async function save(a: Answer) {
    const answer = draft.trim();
    if (!answer) return toast.error("An answer can't be empty — delete it instead.");
    setSaving(true);
    const updated_at = new Date().toISOString();
    const { error } = await supabase
      .from("saved_answers")
      .update({ answer, updated_at })
      .eq("id", a.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setRows((prev) => prev?.map((x) => (x.id === a.id ? { ...x, answer, updated_at } : x)) ?? null);
    setEditing(null);
    toast.success("Saved. Savant Apply will use this next time.");
  }

  async function remove(a: Answer) {
    if (!window.confirm(`Delete your saved answer to "${questionOf(a)}"?`)) return;
    const { error } = await supabase.from("saved_answers").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev?.filter((x) => x.id !== a.id) ?? null);
  }

  return (
    <section>
      <SectionHeading title="Saved answers">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search questions or answers"
          className="w-64 border-b border-foreground bg-transparent py-1 text-sm outline-none"
        />
      </SectionHeading>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        When you submit an application with Savant Apply, it remembers your answers and fills them
        in the next time a form asks the same question. Edit or delete any of them here. Demographic
        answers (gender, race, veteran or disability status) are never saved.
      </p>

      <AutofillSettings />

      {!rows ? (
        <Empty>Loading…</Empty>
      ) : rows.length === 0 ? (
        <Empty>
          Nothing saved yet. Answers appear here after you submit an application with Savant Apply.
        </Empty>
      ) : visible.length === 0 ? (
        <Empty>No saved answers match.</Empty>
      ) : (
        <ul className={`mt-8 ${list}`}>
          {visible.map((a) => (
            <li key={a.id} className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className={label}>{questionOf(a)}</div>
                  {editing === a.id ? (
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={Math.min(8, Math.max(2, Math.ceil(draft.length / 80)))}
                      maxLength={4000}
                      className="mt-2 w-full rounded-sm border border-[color:var(--color-hairline)] bg-transparent p-3 text-sm outline-none focus:border-foreground"
                      autoFocus
                    />
                  ) : (
                    <p className="mt-2 whitespace-pre-line text-sm">{a.answer}</p>
                  )}
                  <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    Updated {timeAgo(a.updated_at)}
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  {editing === a.id ? (
                    <>
                      <button onClick={() => save(a)} disabled={saving} className={linkButton}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditing(null)} className={mutedButton}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditing(a.id);
                          setDraft(a.answer);
                        }}
                        className={linkButton}
                      >
                        Edit
                      </button>
                      <button onClick={() => remove(a)} className={mutedButton}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Savant Apply on this browser: installed or not, and "always autofill". */
function AutofillSettings() {
  const { status, recheck } = useSavantApply();
  const [always, setAlways] = useState(false);
  useEffect(() => setAlways(getAlwaysAutofill()), []);

  return (
    <div className={`mt-8 max-w-2xl ${card}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className={label}>Savant Apply on this browser</div>
          <p className="mt-2 text-sm">
            {status.state === "checking" && "Checking…"}
            {status.state === "installed" &&
              (status.connected
                ? `Installed and connected (version ${status.version}).`
                : "Installed, but not connected — reload this page to connect it.")}
            {status.state === "missing" && "Not installed."}
            {status.state === "unsupported" && "Autofill works in Chrome or Edge on a computer."}
          </p>
        </div>
        <div className="flex items-center gap-5">
          {status.state === "missing" && (
            <button onClick={recheck} className={mutedButton}>
              Check again
            </button>
          )}
          <Link to="/autofill" className={linkButton}>
            {status.state === "missing" ? "Install →" : "How it works →"}
          </Link>
        </div>
      </div>
      <div className="mt-4 border-t border-[color:var(--color-hairline)] pt-3">
        <Toggle
          checked={always}
          disabled={status.state !== "installed"}
          onChange={(on) => {
            setAlways(on);
            setAlwaysAutofill(on);
          }}
          label="Always autofill when available"
          description="Skip the autofill step when you apply and fill supported applications straight away. You still review and submit every one."
        />
      </div>
    </div>
  );
}
