import type { FieldType, FormField } from "./mapper";

/**
 * Greenhouse public Job Board API: read the application form schema without
 * a browser. Used for "readiness" scoring before the candidate ever opens
 * the page. Compliance/EEO structure varies by board.
 */
const TYPE_MAP: Record<string, FieldType> = {
  input_text: "text",
  textarea: "textarea",
  input_file: "file",
  multi_value_single_select: "select",
  multi_value_multi_select: "multiselect",
};

type GhQuestion = {
  label?: string;
  required?: boolean;
  fields?: { name: string; type: string; values?: { label: string; value: string | number }[] }[];
};

function fieldsFrom(
  questions: GhQuestion[] | undefined,
  section?: FormField["section"],
): FormField[] {
  const out: FormField[] = [];
  for (const q of questions ?? []) {
    for (const f of q.fields ?? []) {
      const type = TYPE_MAP[f.type];
      if (!type) continue;
      out.push({
        key: f.name,
        label: q.label ?? f.name,
        type,
        required: !!q.required,
        options: (f.values ?? []).map((v) => ({ label: v.label, value: String(v.value) })),
        section: section ?? (f.name.startsWith("question_") ? "custom" : "standard"),
      });
    }
  }
  return out;
}

export async function getGreenhouseFields(board: string, jobId: string) {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(jobId)}?questions=true`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) throw new Error(`Greenhouse ${res.status}`);
  const job = (await res.json()) as {
    questions?: GhQuestion[];
    compliance?: { questions?: GhQuestion[] }[];
    content?: string;
  };
  let fields = fieldsFrom(job.questions);
  for (const block of job.compliance ?? [])
    fields = fields.concat(fieldsFrom(block.questions, "eeo"));
  return { fields, content: job.content ?? "" };
}
