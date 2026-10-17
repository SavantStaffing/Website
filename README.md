# Savant

Staffing company website.

Site Tech: TanStack Start (React) + Tailwind CSS v4 + shadcn/ui, hosted on Cloudflare Workers.

Authentication: Supabase Auth with Row Level Security (role-based — Admin, Talent, Recruiter)

Supabase connectivity for accounts, organizations, job postings, and job applications

## Design System

Background: warm ivory

Text: near-black ink

Accent: brass/gold

Display font: Fraunces (serif) for headlines and the wordmark; Inter for body copy

Generous whitespace / editorial section spacing throughout

All hover interactions convert to tap interactions on mobile/touch devices

## Site Navigation (main menu)

Home

About

Jobs

Preparation

Services

Contact

## Job Scout Agent

Jobs are pulled from companies' public ATS boards (Greenhouse, Lever, Ashby, SmartRecruiters, Workable), validated, refined, screened for ghost postings, and ranked into each talent's feed. See [docs/job-scout.md](docs/job-scout.md) for how every box on the architecture diagram maps to code and how to switch it on.

## Pages

All pages are scaffolded with placeholder ("Content coming soon") copy.

**Home** — Hero, services preview, programs preview, calls to action for job seekers and employers.

**About** — Company story. Content coming soon.

**Jobs** — Open roles listing. Content coming soon.

**Services** — Staffing services offered (temporary staffing, professional roles, preparation). Content coming soon.

**Programs** — Workforce programs (apprenticeships, training & certification, diversity hiring). Content coming soon.

## Roles & Authorization

Four roles: **Talent**, **Recruiter**, **Career Coach**, **Admin** (plus signed-out guests). Sign up picks Talent or Recruiter; Career Coach and Admin are never self-service — an existing admin promotes a user from `/admin/users`, which goes through a server-side check that re-verifies admin status independently of the database policy that also has to allow it.

The frontend's role checks (route guards, nav visibility, the `can()` permission helper in `src/lib/authz/permissions.ts`) exist for UX only. The actual authorization boundary is Postgres Row Level Security in `supabase/migrations/` — every table read/write is scoped there by role and, for recruiters, by organization membership, so a direct API call can't return more than the RLS policies allow no matter what the client sends.

**Talent** (`/talent`) — Dashboard, Job Feed, Applications, Account, Preferences, Settings. Ranked job feed with refine filters, bookmarks, applications (autofill via the Savant Apply extension), and recruiter invitations. Cannot post jobs or see other users' data.

**Recruiter** (`/recruiter`) — Company Dashboard, Talent Feed, Saved Talent, Jobs, Applications, Company, Account (team permissions). Posts and manages job listings, reviews candidates and applications — all scoped to their own organization via `profiles.organization_id`. A recruiter with no organization assigned sees a message to contact an admin rather than a broken form. Recruiters do not get admin privileges.

**Career Coach** (`/coach`) — Service Requests, Talent, Recruiters, Settings. Receives talent sign-ups for the Preparation services (Career Programs, Resume Building, Interview Development), picks them up and moves them through their status; read-only lists of talent and recruiters. No admin privileges. Assigned by an admin from `/admin/users`.

**Admin** (`/admin`) — Dashboard, Users, Talent, Recruiters, Jobs, Organizations, Settings. Manages every user's role, assigns recruiters to organizations, and can moderate any job posting.

Signing in redirects to `/dashboard`, which sends the user to the right area for their role. Visiting another role's area redirects to `/forbidden` rather than silently hiding navigation.

Auth pages: Sign Up, Login, Password Reset, Email Verification (confirmation screen + redirect).

### Extending this later

Adding a new role or permission means: add the enum value in a migration, add its RLS policies, add it to `ROLE_PERMISSIONS` in `src/lib/authz/permissions.ts`, and add a route group if it needs its own dashboard. Nothing about the existing roles needs to change for that to work — the `has_role()` / `own_organization_id()` SQL helpers and the `requireRole()` route guard were written generically for this.

## Hosting & deployment

- **Site:** Cloudflare Worker `savantalent` serving savantalent.com and www (config in `wrangler.jsonc`). Test address: https://savantalent.savantstaffing.workers.dev
- **Database, auth, file storage:** Supabase project `savantalent-prod` (`auldwzcqtjpwmliqqoyj`). Public URL and publishable key are in `.env` and `wrangler.jsonc`.
- **Private keys** (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`) are Cloudflare secrets: `npx wrangler secret put NAME`.
- **Deploy:** `npm run deploy` (builds, then uploads with Wrangler).
- **Job Scout:** Supabase Edge Function `job-scout`, called by pg_cron every 15 minutes. Deploy with `npx supabase functions deploy job-scout --project-ref auldwzcqtjpwmliqqoyj --use-api`.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone https://github.com/SavantStaffing/Website.git
cd Website
npm i
npm run dev
```
