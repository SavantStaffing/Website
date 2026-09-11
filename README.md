# Savant

Staffing company website.

Site Tech: TanStack Start (React) + Tailwind CSS v4 + shadcn/ui, structured for the [Lovable](https://lovable.dev) editor.

Authentication: Supabase Auth (role-based — Admin, Job Seeker, Recruiter)

Supabase connectivity for accounts, job postings, and job applications

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

## Accounts & Roles

Sign up chooses one of two roles: **Job Seeker** or **Recruiter**. Admin is not self-service — promote a user by inserting a row into `user_roles` directly.

**Job Seeker** — browses `/jobs`, applies to postings, tracks applications at `/hub/candidate`.

**Recruiter** — posts and manages job listings at `/hub/recruiter`.

**Admin** — views all users/roles and all postings at `/hub/admin`.

Auth pages: Sign Up, Login, Password Reset, Email Verification (confirmation screen + redirect).

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
