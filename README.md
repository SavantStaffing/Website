# Savant

Staffing company website.

Site Tech: TanStack Start (React) + Tailwind CSS v4 + shadcn/ui, structured for the [Lovable](https://lovable.dev) editor.

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

Services

Programs

## Pages

All pages are scaffolded with placeholder ("Content coming soon") copy, ready to be filled in from the Lovable editor.

**Home** — Hero, services preview, programs preview, calls to action for job seekers and employers.

**About** — Company story. Content coming soon.

**Jobs** — Open roles listing. Content coming soon.

**Services** — Staffing services offered (temporary staffing, direct hire, executive search, payrolling). Content coming soon.

**Programs** — Workforce programs (apprenticeships, training & certification, diversity hiring). Content coming soon.

## Roles & Authorization

Three roles: **Talent**, **Recruiter**, **Admin**. Sign up picks Talent or Recruiter; Admin is never self-service — an existing admin promotes a user from `/admin/users`, which goes through a server-side check that re-verifies admin status independently of the database policy that also has to allow it.

The frontend's role checks (route guards, nav visibility, the `can()` permission helper in `src/lib/authz/permissions.ts`) exist for UX only. The actual authorization boundary is Postgres Row Level Security in `supabase/migrations/` — every table read/write is scoped there by role and, for recruiters, by organization membership, so a direct API call can't return more than the RLS policies allow no matter what the client sends.

**Talent** (`/talent`) — Dashboard, Find Jobs, Applications, Profile. Browses and applies to jobs, saves listings, tracks application status. Cannot post jobs or see other users' data.

**Recruiter** (`/recruiter`) — Dashboard, Jobs, Candidates, Applications, Company. Posts and manages job listings, reviews candidates and applications — all scoped to their own organization via `profiles.organization_id`. A recruiter with no organization assigned sees a message to contact an admin rather than a broken form. Recruiters do not get admin privileges.

**Admin** (`/admin`) — Dashboard, Users, Talent, Recruiters, Jobs, Organizations, Settings. Manages every user's role, assigns recruiters to organizations, and can moderate any job posting.

Signing in redirects to `/dashboard`, which sends the user to the right area for their role. Visiting another role's area redirects to `/forbidden` rather than silently hiding navigation.

Auth pages: Sign Up, Login, Password Reset, Email Verification (confirmation screen + redirect).

### Extending this later

Adding a new role or permission means: add the enum value in a migration, add its RLS policies, add it to `ROLE_PERMISSIONS` in `src/lib/authz/permissions.ts`, and add a route group if it needs its own dashboard. Nothing about the existing roles needs to change for that to work — the `has_role()` / `own_organization_id()` SQL helpers and the `requireRole()` route guard were written generically for this.

## Connecting to Lovable

This repo isn't yet linked to a Lovable project, so Supabase isn't connected either — auth and job-posting features will show a "Connect Supabase" error in the console until it is. To connect:

1. Create a new project at [lovable.dev](https://lovable.dev) and choose "Import from GitHub."
2. Point it at this repository.
3. Enable Lovable Cloud / Supabase for the project. Lovable will provision a Supabase project and apply the schema in `supabase/migrations/`.
4. Once connected, edits made in the Lovable editor sync straight back to this repo, and `git push` to the connected branch syncs back into the editor.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone https://github.com/SavantStaffing/Website.git
cd Website
npm i
npm run dev
```
