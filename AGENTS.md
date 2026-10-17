> [!IMPORTANT]
> Hosting: Cloudflare Worker "savantalent" (wrangler.jsonc). Database/auth/storage:
> Supabase project savantalent-prod (auldwzcqtjpwmliqqoyj). The site is no longer
> connected to Lovable. Database changes go in supabase/migrations/ and must be
> applied to savantalent-prod; private keys live in Cloudflare secrets, never in git.

- Keep scheduled scans authenticated by the database cron token and limited to the stalest enabled companies; the existing scheduler calls this contract.
- Serve the public employer rating bundle through a server function while keeping its privileged database function service-role-only.
- Scanners for JSON search-API careers sites live in src/lib/scout/search-apis.ts and share one paginate() helper; list-then-detail HTML sites (iCIMS, Avature) live in jobposting.ts — add new platforms to the matching module, then run scripts/build-scout-function.mjs.
