# Isolated tutorial staging

This staging target uses the website code but a **new Supabase project** and a separate Cloudflare Worker named `savantalent-staging`. Both existing Savant Supabase projects are rejected by the staging tooling. Production domain routes and secrets are excluded from the generated deployment configuration.

## Current prerequisite

Select the Supabase organization and approve any nonzero quoted project cost before provisioning. The connected organization is `Savant`. Do not repurpose either existing Savant project or copy production users, resumes, applications, storage objects, secrets or tokens.

## Configure and verify

1. Provision a fresh project and record its reference and public publishable key.
2. Initialize its schema from the repository migrations in an isolated transaction, with all cron jobs disabled before commit. Review the migrations first: `20260927000006_schedule_job_scout.sql` contains an existing-project URL and must never be allowed to run its schedule in staging. Do not deploy job-scout or enable any scheduled scans.
3. Create synthetic demo identities with confirmed emails through the staging Auth admin API, then insert only synthetic organizations, jobs, profiles and applications. Do not send signup or password-reset mail. Keep external application links on reserved `.invalid` hostnames.
4. Copy `staging.settings.example.json` to `staging.settings.local.json` and fill in the new project reference, its publishable key and the verified Cloudflare account ID. This file is gitignored. No secret key belongs in this file.
5. Run `npm run test:staging` and `npm run build:staging`. The latter builds using explicit staging browser/server variables, checks bundles for both existing project references and performs a Wrangler dry run. It does not deploy.
6. Once the database and artifacts are verified, run `npm run deploy:staging`. This builds again and uses only the generated staging configuration. Never use `npm run deploy` for staging.
7. Store only the new project's server-role key as a secret on `savantalent-staging` if server-side admin features need it. Do not copy production secrets. Leave Resend, external AI providers, scanner credentials and scheduled tasks unconfigured.
8. Configure staging Auth site URL/redirect URLs to the resulting workers.dev origin. Confirm login/logout, role access, job feed and applications using the synthetic identity. Inspect browser network traffic to confirm that database traffic goes only to the new project.
9. Configure Savantutorials `STAGING_BASE_URL` and `STAGING_ALLOWED_ORIGIN` to that verified origin. Validate its login selectors and tutorial scenes against the real staging UI before recording.

Cloudflare's existing `savantalent.savantstaffing.workers.dev` address is **not isolated staging**: the current configuration uses the production database.

## Deployment protections and limits

The staging script explicitly constructs the Worker configuration rather than inheriting production routes, vars, bindings or cron triggers. It compiles the browser with staging Supabase settings and rejects bundles containing either existing Savant project reference. A missing configuration, private key in place of a publishable key, invalid account ID, missing generated config or failed build stops deployment.

No production migration, DNS route, Worker or database is changed by these staging scripts. The production deploy command remains unchanged. The external tutorial agent still enforces its own network/action limits. Staging is a real application: use synthetic data and leave external integration credentials absent.
