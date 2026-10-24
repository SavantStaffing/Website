import { z } from "zod";

/** Accepts "acme.com" or "https://acme.com" and stores a full URL. */
const url = (msg: string) =>
  z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
    .pipe(z.string().url(msg));

const name = (field: string) => z.string().trim().min(1, `${field} is required`).max(80);

export const talentDetailsSchema = z
  .object({
    first_name: name("First name"),
    last_name: name("Last name"),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^\+?[\d\s().-]{7,}$/, "Enter a valid phone number"),
    linkedin_url: z.union([z.literal(""), url("LinkedIn must be a valid link")]),
  })
  .transform((d) => ({ ...d, linkedin_url: d.linkedin_url || null }));

export const recruiterDetailsSchema = z.object({
  first_name: name("First name"),
  last_name: name("Last name"),
  company_name: z.string().trim().min(2, "Company name is required").max(160),
  company_website: url("Company website must be a valid link"),
});

export type ProfileDetailsRow = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company_name: string | null;
  company_website: string | null;
  created_at: string;
};

/** Talent/coach accounts created before this date only need a name. */
const PHONE_REQUIRED_SINCE = "2026-10-04T00:00:00Z";

export function needsDetails(
  role: string,
  p: ProfileDetailsRow | null,
  talentName?: { first_name: string | null; last_name: string | null } | null,
): boolean {
  if (role === "admin" || !p) return false;
  const first = p.first_name || talentName?.first_name;
  const last = p.last_name || talentName?.last_name;
  if (role === "recruiter") return !first || !last || !p.company_name || !p.company_website;
  if (!first || !last) return true;
  return !p.phone && p.created_at >= PHONE_REQUIRED_SINCE;
}
