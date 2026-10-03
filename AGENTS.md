<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Keep scheduled scans authenticated by the database cron token and limited to the stalest enabled companies; the existing scheduler calls this contract.
- Serve the public employer rating bundle through a server function while keeping its privileged database function service-role-only.
- Scanners for JSON search-API careers sites live in src/lib/scout/search-apis.ts and share one paginate() helper; list-then-detail HTML sites (iCIMS, Avature) live in jobposting.ts — add new platforms to the matching module, then run scripts/build-scout-function.mjs.
