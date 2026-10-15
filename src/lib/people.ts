/**
 * What to call someone. Real names aren't unique, so lists that staff act on
 * show the email (or @username) underneath to tell two "Sarah Lee"s apart.
 */
export type NamedProfile = {
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
};

/** Real name (talent profile name first, if given), else username, else email. */
export function personName(
  p: NamedProfile | null | undefined,
  talentName?: string | null,
  fallback = "—",
): string {
  return (
    talentName?.trim() ||
    p?.full_name?.trim() ||
    p?.username?.trim() ||
    p?.email?.trim() ||
    fallback
  );
}

/** "First Last" from a talent profile row, or "". */
export const talentFullName = (
  t: { first_name?: string | null; last_name?: string | null } | null | undefined,
) =>
  [t?.first_name, t?.last_name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");

/** The line under a name: email, or @username when the email isn't shown. */
export function personDetail(
  p: NamedProfile | null | undefined,
  { email = true } = {},
): string | null {
  if (email && p?.email) return p.email;
  return p?.username ? `@${p.username}` : null;
}
