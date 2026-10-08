/** URL state for the Chat pages: ?c=<conversation> or ?to=<person>. */
export function chatSearch(s: Record<string, unknown>): { c?: string; to?: string } {
  return {
    c: typeof s.c === "string" ? s.c : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
  };
}
