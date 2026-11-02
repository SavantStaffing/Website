// Unit checks for the coach ghost-listing verdict (src/lib/coach/listing.ts).
//   node scripts/coach-ghost-test.ts
import assert from "node:assert/strict";
import {
  analyzeListing,
  CLOSED_RE,
  parsePostedText,
  publicHttpUrl,
  urlKey,
  type Evidence,
  type ListingInput,
} from "../src/lib/coach/listing.ts";

const NOW = new Date("2026-11-01T12:00:00Z");
const LONG =
  "You will own the monthly close for two subsidiaries, reconcile intercompany balances, " +
  "prepare variance analysis for the controller, and help us move from NetSuite to a new consolidation tool. " +
  "Requires 3+ years in accounting, strong Excel, and CPA or CPA-track. Hybrid in Oakland, three days in office. " +
  "Benefits include medical, dental, 401k match and a learning stipend. Interviews: phone screen, case, panel.";

const listing = (o: Partial<ListingInput> = {}): ListingInput => ({
  url: "https://boards.greenhouse.io/acme/jobs/123",
  title: "Staff Accountant",
  company: "Acme",
  location: "Oakland, CA",
  description: LONG,
  description_read: true,
  posted_at: "2026-10-20T00:00:00Z",
  valid_through: null,
  closed_banner: null,
  apply_control: true,
  posted_text: null,
  reposted: false,
  ...o,
});
const evidence = (o: Partial<Evidence> = {}): Evidence => ({
  live: "unknown",
  live_source: null,
  known: null,
  repost_others: 0,
  llm: [],
  ai_reviewed: false,
  now: NOW,
  ...o,
});

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

test("fresh, detailed posting passes", () => {
  const v = analyzeListing(listing(), evidence());
  assert.equal(v.verdict, "pass");
  assert.equal(v.confidence, "medium");
  assert.equal(v.score, 0);
});

test("board says closed → NO PASS, high confidence", () => {
  const v = analyzeListing(listing(), evidence({ live: "closed", live_source: "Greenhouse" }));
  assert.equal(v.verdict, "no_pass");
  assert.equal(v.confidence, "high");
  assert.equal(v.signals[0].id, "board_closed");
});

test("board says open → high confidence pass", () => {
  const v = analyzeListing(listing(), evidence({ live: "open", live_source: "Greenhouse" }));
  assert.equal(v.verdict, "pass");
  assert.equal(v.confidence, "high");
});

test("closed banner and expired validThrough are hard stops", () => {
  assert.equal(
    analyzeListing(
      listing({ closed_banner: "This job is no longer accepting applications" }),
      evidence(),
    ).verdict,
    "no_pass",
  );
  assert.equal(
    analyzeListing(listing({ valid_through: "2026-09-01T00:00:00Z" }), evidence()).verdict,
    "no_pass",
  );
});

test("Savant already closed it → NO PASS", () => {
  const known = { status: "closed", first_seen_at: "2026-09-01T00:00:00Z", ghost_override: false };
  assert.equal(analyzeListing(listing(), evidence({ known })).verdict, "no_pass");
});

test("old + evergreen wording crosses the threshold", () => {
  const v = analyzeListing(
    listing({
      posted_at: "2026-02-01T00:00:00Z",
      description: `${LONG} Join our talent community for future opportunities.`,
    }),
    evidence(),
  );
  assert.equal(v.verdict, "no_pass");
  assert.ok(v.score >= 50);
});

test("page wording 'Posted 45 days ago' feeds the age check", () => {
  const v = analyzeListing(
    listing({ posted_at: null, posted_text: "Posted 45 days ago" }),
    evidence(),
  );
  assert.equal(v.checks.age_days, 45);
  assert.equal(v.verdict, "pass"); // 45 days alone is under every age tier
  // Scout tiers: >120 days = 40 points (a warning), >365 days = 50 (a stop on its own).
  const aging = analyzeListing(
    listing({ posted_at: null, posted_text: "Posted 5 months ago" }),
    evidence(),
  );
  assert.equal(aging.verdict, "pass");
  assert.equal(aging.score, 40);
  const old = analyzeListing(
    listing({ posted_at: null, posted_text: "Posted 13 months ago" }),
    evidence(),
  );
  assert.equal(old.verdict, "no_pass");
});

test("asks for money → scam NO PASS", () => {
  const v = analyzeListing(
    listing({ description: `${LONG} A processing fee is due before training.` }),
    evidence(),
  );
  assert.equal(v.verdict, "no_pass");
  assert.ok(v.signals.some((s) => s.id === "scam"));
});

test("reposts push a stale listing over the line", () => {
  const v = analyzeListing(
    listing({ posted_at: "2026-08-20T00:00:00Z", reposted: true }),
    evidence({ repost_others: 2 }),
  );
  assert.equal(v.verdict, "no_pass");
});

test("AI signals are capped (15 each, 30 total)", () => {
  const llm = [1, 2, 3].map((i) => ({ kind: `k${i}`, text: "vague", evidence: "q", points: 40 }));
  const v = analyzeListing(listing(), evidence({ llm, ai_reviewed: true }));
  assert.equal(v.score, 30);
  assert.equal(v.verdict, "pass");
});

test("admin 'this is real' override rescues a score-based flag but not a hard stop", () => {
  const known = { status: "active", first_seen_at: "2026-01-01T00:00:00Z", ghost_override: true };
  const old = listing({ posted_at: "2025-06-01T00:00:00Z" });
  assert.equal(analyzeListing(old, evidence({ known })).verdict, "pass");
  assert.equal(
    analyzeListing(old, evidence({ known, live: "closed", live_source: "Lever" })).verdict,
    "no_pass",
  );
});

test("unreadable sheet row: pass is low confidence and says to check", () => {
  const v = analyzeListing(
    listing({ description: null, description_read: false, posted_at: null, apply_control: null }),
    evidence(),
  );
  assert.equal(v.verdict, "pass");
  assert.equal(v.confidence, "low");
  assert.match(v.summary, /open it and check/);
});

test("closed-banner regex catches common phrasings, ignores normal text", () => {
  for (const s of [
    "This position has been filled",
    "Job is no longer available",
    "We are no longer accepting applications",
    "Applications are closed",
    "This job has expired",
  ])
    assert.ok(CLOSED_RE.test(s), s);
  for (const s of [
    "We are hiring a closer for our sales team",
    "Close collaboration with finance",
    "Apply now",
  ])
    assert.ok(!CLOSED_RE.test(s), s);
});

test("parsePostedText", () => {
  assert.equal(parsePostedText("2 weeks ago"), 14);
  assert.equal(parsePostedText("Posted 30+ days ago"), 30);
  assert.equal(parsePostedText("a month ago"), 30);
  assert.equal(parsePostedText("Posted today"), 0);
  assert.equal(parsePostedText("Over a year ago"), 366);
  assert.equal(parsePostedText("Apply by Friday"), null);
});

test("publicHttpUrl refuses internal targets", () => {
  assert.ok(publicHttpUrl("https://jobs.lever.co/acme/abc"));
  for (const bad of [
    "http://localhost:3000/x",
    "http://127.0.0.1/x",
    "http://169.254.169.254/latest/meta-data",
    "https://[::1]/x",
    "https://intranet/x",
    "https://svc.internal/x",
    "ftp://example.com/x",
    "https://user:pw@example.com/x",
    "file:///etc/passwd",
  ])
    assert.equal(publicHttpUrl(bad), null, bad);
});

test("urlKey drops tracking, hash, www and trailing slash", () => {
  assert.equal(
    urlKey("https://www.Acme.com/careers/123/?utm_source=x#apply"),
    "acme.com/careers/123",
  );
});

console.log(`\n${n} checks passed`);
