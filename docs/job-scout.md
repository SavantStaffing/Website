# Savant architecture: where each box lives

How the architecture diagram maps to code, and how to switch each piece on.

## Website foundational pages

| Diagram | Route |
|---|---|
| Home, About, Services | `/`, `/about`, `/services` |
| Jobs (guest feed preview) | `/jobs` — first 6 ranked live roles + sign-up prompt |
| Career Programs | `/programs` |
| Contact | `/contact` → `contact_messages`, read at `/admin/messages` |
| Sign up | `/auth?mode=signup` |

## Interfaces

**Admin** (`/admin`)
- Registered users log, categorized → `/admin/users` (filter by role, join date)
- Complete permissions → role changes on `/admin/users`; org + permission level on `/admin/recruiters`
- Internal diagnostics → `/admin/diagnostics`: per source proxy health, rate-limit health, HTTP status, success rate, response time; live/flagged/ingested counts; field-level fill rates by source; schema-validation failures by source
- Glassdoor / ZipRecruiter (and LinkedIn, Indeed, Google) → `/admin/settings` → Job boards
- Job Scout control → `/admin/scout`

**Recruiter** (`/recruiter`)
- Talent feed → `/recruiter/talent` (profiles talent made visible)
- Saved talent → `/recruiter/saved`
- Request application → "Request application" on any talent; the talent gets a notification (DB trigger)
- Company dashboard → `/recruiter`: job listings with date posted, # applicants, # requested applications; hires; bookmarked talent
- Account settings / info / permissions → `/recruiter/account` (point of contact, owner/manager/member/viewer), `/recruiter/company` (only owner/manager can edit company info)

**Talent** (`/talent`)
- Job feed → `/talent/jobs`, ranked by preferences, with the refine filters (position, industry/NAICS, date posted, location, schedule, remote)
- Apply + Autofill → "Apply" (Savant-posted roles) or "Apply on company site" + the Savant Apply extension (`extension/`)
- Talent dashboard → `/talent`: applications, bookmarked jobs, recruiter invitations
- Account info → `/talent/profile` (contact info + professional/autofill profile), `/talent/preferences`
- Account settings → `/talent/settings`

**Career Coach** (`/coach`, assigned by an admin on `/admin/users`)
- Service requests → sign-ups for the Preparation services from `/preparation`; "Take it" assigns to you, status moves New → In progress → Completed/Cancelled; the talent is notified at each step
- Talent and Recruiters → read-only lists
- Account settings → `/coach/settings`

**Guest** → the foundational pages + the `/jobs` feed preview. The Preparation page's sign-up buttons send guests to create a talent account.

## Job Scout Agent (`src/lib/scout/`)

```
Admin input (/admin/scout) ─┐              ┌─ Job scraper: JobSpy service (optional, services/jobspy)
Scheduled (/api/scout/run) ─┤              │
                            ▼              ▼
  Passing score from auditor: JUST Capital rank ≤ 50 / As You Sow DEI ≥ 40% (ratings.ts)
     fails a list it's on → skipped, live postings closed · on neither list → normal filters
  → Company Web Scan (webscan.ts) → Identify ATS platform (detect.ts), remembered on the config row
  → Config table of companies with ATS endpoints (scout_companies)
  → Call endpoint → Map into site schema (sources.ts: Greenhouse, Lever, Ashby, SmartRecruiters,
     Workable; workday.ts: Workday; jobposting.ts: iCIMS + any careers site's JobPosting markup)
  → Data-quality check: schema validation, default ≥ 80% of a board's postings (validate.ts)
  → Refine parameters: position, seniority, industry + NAICS, date posted, location, remote, schedule (refine.ts)
  → Ghost Job Detector v2: explainable score, ≥ 50 held for admin review (ghost.ts)
  → Normalization → upsert into jobs; postings gone from a board are closed (pipeline.ts)
  → User feed ranking + recruiter score (rank.ts) → talent feed → autofill (src/lib/autofill)
```

### Sources without an ATS API (no LLM)

- **Workday** (`workday.ts`) — any `…myworkdayjobs.com` / `…myworkdaysite.com` site, via the
  JSON endpoints its own page uses. Lists up to 400 postings; the newest 40 also get a detail
  fetch (exact date, description, schedule, remote).
- **iCIMS** (`jobposting.ts`) — `careers-acme.icims.com` portals; reads each job page's JobPosting
  markup. iCIMS's markup dates are synthetic, so first-seen tracking ages these instead; the
  location comes from the page header.
- **Careers site markup** (`jobposting.ts`, stored as `jsonld`) — the fallback when a careers page
  uses no known ATS: JobPosting markup on the page, job-page links, or the sitemap. Up to 60 job
  pages per company. Sites that build their listings in the browser with JavaScript (no markup,
  no sitemap) still come back "No supported ATS" — that's what an LLM extractor would cover.

### Temp partner listings (Bluecrew, WorkWhile, Instawork)

The partner apps have no public feed, so their open listings come from a
sheet gathered by hand, transcribed into `src/data/temp-listings.ts`. That
file drives both the Temp & hourly job feed and the partner overviews on
`/temporary-staffing`. To refresh it:

1. Replace `LISTINGS` with the new sheet's rows and update `LISTINGS_AS_OF`.
2. `node scripts/temp-listings-sql.ts > supabase/migrations/<timestamp>_temp_listings.sql`
3. Apply the migration. It upserts the listings, closes ones that dropped
   off, and closes any whose employer misses the equity filter.

Listings drop out of the feed `LISTINGS_VALID_DAYS` (14) days after
`LISTINGS_AS_OF` unless refreshed.

### Employer ratings gate

Managed on **`/admin/ratings`**: cutoffs, whether a company on both lists must
pass both (default) or either, a company lookup, and CSV upload to replace a
list when it's republished. The seeded data lives in `data/company-ratings/`:
JUST Capital's 2026 top 105 (read from justcapital.com/rankings; it has no
export, so spot-check it) and As You Sow's California DEI scores. Names are
matched after stripping legal suffixes ("Salesforce.com Inc" = "SALESFORCE,
INC"); for a mismatch, use **Match name** on the company's row in
`/admin/scout`, or force a company in or out with its override. Passing
employers' postings carry a badge in the feed and rank slightly higher.
Job-board postings are gated per posting by their employer name.

`node scripts/scout-smoke.ts` runs the real pipeline against live boards with an
in-memory store — no database needed. Pass a careers URL to try one company:
`node scripts/scout-smoke.ts https://www.figma.com/careers/ Figma`.

## Turning it on

1. **Apply the migrations** `20260924000000_job_scout_and_role_features.sql` and
   `20260925000000_company_ratings_gate.sql`, `20260926000000_career_coach_role.sql` and
   `20260926000001_preparation_services.sql` in `supabase/migrations/`, in that order
   (Lovable applies migrations when you sync; or `supabase db push`). Then
   regenerate `src/integrations/supabase/types.ts` — the committed copy was
   hand-written to match the migration.
2. **Make an owner per company**: `/admin/recruiters` → assign the org, set
   one person to *Owner*. They manage their own team from then on.
3. **Add companies** on `/admin/scout` (paste a careers page; "Identify ATS"
   finds the board) and press *Scan all*.
4. **Scheduled scans run in Supabase** (already set up on Savant Talent):
   pg_cron calls the `job-scout` Edge Function every 15 minutes
   (migration `20260927000006_schedule_job_scout.sql`). Each call scans the
   enabled company scanned longest ago, so companies are refreshed in turn —
   with 11 companies, about every 3 hours. One company per call keeps each
   run inside the Edge Function limits (2s CPU); careers-site crawls are
   capped at 35 job pages there. Runs show up on `/admin/diagnostics` as
   "scheduled".

   The function runs the same `src/lib/scout` code as the app. After changing
   it, rebuild the copy and redeploy:

   ```bash
   node scripts/build-scout-function.mjs
   supabase functions deploy job-scout --no-verify-jwt
   ```

   Auth is a random token in `scout_settings.cron_token` that only the
   database and the function see. Pause the schedule with
   `select cron.unschedule('savant-job-scout');`.

   (`/api/scout/run` with `SCOUT_CRON_SECRET` remains as an alternative that
   runs scans on the website's own server.)

## Server environment variables

| Variable | Needed for |
|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | everything (set by Lovable Cloud) |
| `SCOUT_CRON_SECRET` | scheduled scans via `/api/scout/run` |
| `ANTHROPIC_API_KEY` (optional `DRAFT_MODEL`, default `claude-sonnet-5`) | autofill drafting answers to open-ended questions from the resume |
| `JOBSPY_URL`, `JOBSPY_TOKEN` | job-board scraping — read `services/jobspy/README.md` first |
| `VITE_SAVANT_APPLY_EXTENSION_ID` | lets the site hand the talent's session to the extension |

## Savant Apply extension (`extension/`)

Ported from the Autofill prototype. Its backend is now the site itself
(`/api/autofill/plan`, `/api/autofill/answers`), so the separate FastAPI
service isn't needed. Set `API` in `extension/background.js` to the site
URL, load the folder unpacked in Chrome, and put its extension ID in
`VITE_SAVANT_APPLY_EXTENSION_ID`. It never submits a form — it fills,
highlights what needs review, and remembers answers when the talent submits.
Resume *file* upload isn't wired yet (profiles store resume text only).
