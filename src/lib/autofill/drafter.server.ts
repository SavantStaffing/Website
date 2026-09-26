import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Fill } from "./mapper";

/**
 * Draft open-ended answers ("Why do you want to work here?") from the resume.
 * Drafts are always flagged needs_review; the candidate edits before
 * submitting. Skipped entirely when ANTHROPIC_API_KEY isn't set.
 */

const SYSTEM = `You draft answers to job application questions for a candidate.
Use only facts found in the resume; never invent experience, numbers, or credentials.
Write in first person, specific to the job, 60-120 words each.
If a question cannot be answered from the resume, return an empty string for it.`;

const DraftSchema = z.object({
  answers: z.array(z.object({ question: z.string(), answer: z.string() })),
});

export async function draftOpenAnswers(
  fills: Fill[],
  resumeText: string | null | undefined,
  jobDescription: string | null | undefined,
): Promise<void> {
  const targets = fills.filter(
    (f) => f.type === "textarea" && f.source === "none" && f.section !== "eeo",
  );
  if (!targets.length || !resumeText || !jobDescription || !process.env.ANTHROPIC_API_KEY) return;

  const client = new Anthropic();
  let response;
  try {
    response = await client.messages.parse({
      model: process.env.DRAFT_MODEL || "claude-sonnet-5",
      max_tokens: 4000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `RESUME:\n${resumeText.slice(0, 12000)}\n\nJOB DESCRIPTION:\n${jobDescription.slice(0, 6000)}\n\n` +
            `QUESTIONS (answer each, copying the question text exactly):\n${targets.map((f) => `- ${f.label}`).join("\n")}`,
        },
      ],
      output_config: { format: zodOutputFormat(DraftSchema) },
    });
  } catch (error) {
    // Drafting is a nice-to-have: a failure leaves the fields for the candidate.
    if (error instanceof Anthropic.APIError)
      console.error(`[autofill] draft failed (${error.status}): ${error.message}`);
    else console.error("[autofill] draft failed", error);
    return;
  }
  if (response.stop_reason === "refusal" || !response.parsed_output) return;

  const byQuestion = new Map(
    response.parsed_output.answers.map((a) => [a.question.trim(), a.answer.trim()]),
  );
  for (const f of targets) {
    const a = byQuestion.get(f.label.trim());
    if (a) Object.assign(f, { value: a, source: "llm_draft", needs_review: true });
  }
}
