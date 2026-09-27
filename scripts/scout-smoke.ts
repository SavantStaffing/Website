/**
 * Runs the real Job Scout pipeline against live public ATS boards with an
 * in-memory store — no database needed. Useful after changing an adapter.
 *
 *   node scripts/scout-smoke.ts                     # default sample companies
 *   node scripts/scout-smoke.ts https://jobs.lever.co/acme  "Acme"
 *   node scripts/scout-smoke.ts https://www.randstadusa.com/jobs/ "Randstad" agency
 *
 * Needs Node 22.6+ (native TypeScript type stripping).
 */
import { runScout, type ExistingJob, type ScoutStore } from "../src/lib/scout/pipeline.ts";
import type { NormalizedJob, ScoutCompany } from "../src/lib/scout/types.ts";

const [, , argUrl, argName, argType] = process.argv;

const companies: ScoutCompany[] = (
  argUrl
    ? [
        {
          name: argName ?? "Custom",
          careers_url: argUrl,
          company_type: argType === "agency" ? ("staffing_agency" as const) : ("employer" as const),
        },
      ]
    : [
        { name: "Stripe", careers_url: "https://job-boards.greenhouse.io/stripe" },
        { name: "Palantir", careers_url: "https://jobs.lever.co/palantir" },
        { name: "OpenAI", careers_url: "https://jobs.ashbyhq.com/openai" },
      ]
).map((c, i) => ({
  id: `c${i}`,
  ats: null,
  ats_token: null,
  industry: null,
  naics_code: null,
  enabled: true,
  ...c,
}));

const jobs = new Map<string, NormalizedJob & { first_seen_at: string; last_seen_at: string }>();

const store: ScoutStore = {
  async listCompanies() {
    return companies;
  },
  async updateCompany(id, patch) {
    Object.assign(
      companies.find((c) => c.id === id)!,
      patch,
    );
  },
  async existingJobs(source, ids): Promise<ExistingJob[]> {
    return ids
      .map((id) => jobs.get(`${source}:${id}`))
      .filter((j) => j !== undefined)
      .map((j) => ({
        source: j.source,
        external_id: j.external_id,
        first_seen_at: j.first_seen_at,
        ghost_override: false,
      }));
  },
  async fingerprintCounts(fps, exclude) {
    const out = new Map<string, number>();
    for (const [key, j] of jobs) {
      if (exclude.has(key) || !fps.includes(j.fingerprint)) continue;
      out.set(j.fingerprint, (out.get(j.fingerprint) ?? 0) + 1);
    }
    return out;
  },
  async upsertJobs(rows) {
    let inserted = 0;
    let updated = 0;
    for (const r of rows) {
      const key = `${r.source}:${r.external_id}`;
      const prev = jobs.get(key);
      if (prev) updated++;
      else inserted++;
      jobs.set(key, { ...r, first_seen_at: prev?.first_seen_at ?? r.last_seen_at });
    }
    return { inserted, updated };
  },
  async closeUnseen() {
    return 0;
  },
  async registerUniqueScanner(site) {
    console.log(
      `→ unique-scanner registry: ${site.name} (${site.platform ?? "unknown platform"}) — ${site.reason}`,
    );
  },
  async resolveUniqueScanner() {},
};

const summary = await runScout(store);

console.log("\n== Outcomes");
console.table(
  summary.outcomes.map((o) => ({
    company: o.company,
    ats: o.ats,
    status: o.status,
    found: o.found,
    passRate: `${Math.round(o.passRate * 100)}%`,
    inserted: o.inserted,
    flagged: o.flagged,
    error: o.error?.slice(0, 60) ?? "",
  })),
);
console.log("== Identified ATS (remembered on the config row)");
console.table(companies.map((c) => ({ name: c.name, ats: c.ats, token: c.ats_token })));
console.log("== Diagnostics per source");
console.table(
  summary.metrics.map((m) => ({
    source: m.source,
    requests: m.requests,
    ok: m.successes,
    "429": m.rate_limited,
    avgMs: m.avg_response_ms,
    ingested: m.jobs_ingested,
    schemaFail: m.schema_failures,
    fill: Object.entries(m.field_fill_rates)
      .map(([k, v]) => `${k}:${Math.round(v * 100)}%`)
      .join(" "),
  })),
);

const all = [...jobs.values()];
console.log("== Sample normalized jobs");
console.table(
  all.slice(0, 8).map((j) => ({
    title: j.title.slice(0, 40),
    company: j.company_name,
    loc: j.location?.slice(0, 24),
    type: j.employment_type,
    seniority: j.seniority,
    remote: j.remote,
    posted: j.posted_at?.slice(0, 10),
    ghost: j.ghost_score,
    track: j.track,
  })),
);
const byTrack = (t: string) => all.filter((j) => j.track === t);
console.log(
  `== Feed tracks: ${byTrack("hourly").length} temp & hourly, ${byTrack("professional").length} professional`,
);
for (const t of ["hourly", "professional"])
  console.table(
    byTrack(t)
      .slice(0, 6)
      .map((j) => ({
        track: t,
        title: j.title.slice(0, 44),
        pay: (j.pay_max ?? j.pay_min) ? `${j.pay_min ?? ""}-${j.pay_max ?? ""}/${j.pay_unit}` : "",
        why: j.track_reasons.join("; ").slice(0, 60),
      })),
  );
const flagged = all.filter((j) => j.status === "flagged");
console.log(`== Ghost detector flagged ${flagged.length} of ${all.length}`);
console.table(
  flagged.slice(0, 6).map((j) => ({
    title: j.title.slice(0, 40),
    score: j.ghost_score,
    why: j.ghost_reasons.join("; "),
  })),
);
console.log("totals", summary.totals, "status", summary.status);
