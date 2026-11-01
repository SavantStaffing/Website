# Legacy Savantalent → savantalent-prod reconciliation

This workflow runs **only when manually dispatched**. It does not delete the Canada Central project, overwrite existing production rows, or copy auth users.

## Configure GitHub environment secrets

Repository → Settings → Environments → create `savant-db-migration`.
Prefer **required reviewers** for this environment, especially before running migrate.

In that environment, add two secrets:

- `SOURCE_DATABASE_URL`: Canada Central (`tohslisvzeliehezgnod`) PostgreSQL session-pooler URI
- `TARGET_DATABASE_URL`: US East production (`auldwzcqtjpwmliqqoyj`) PostgreSQL session-pooler URI

Get the URIs from each project's Supabase dashboard → **Connect** → Session pooler. Never commit them or paste them into chat.

## Run

1. Merge the PR to main after review.
2. Repository → Actions → **Audit / migrate legacy Savantalent database** → Run workflow → `audit`.
3. Download `savant-db-audit-report` from the workflow run and inspect `migration-report.json`.
4. **Back up both databases externally** before using `migrate`. This workflow does not create backups.
5. Only after reviewing the audit and backups, run `migrate`.
6. Download the migration report and resolve all `manual_review_*`, `partial_needs_review`, and `unkeyed_source_rows` findings.
7. Re-run `audit` and independently verify the final row counts and functionality.

## Safety limitations

- The script copies only safe public tables with matching columns, usable keys, and no target foreign keys.
- Auth accounts, identity tables, live settings, and relational user data are **deliberately excluded** from automated copying.
- Tables missing in production and schema mismatches require separate review.
- Unique keys are compared using business keys where defined; conflicting production records are preserved.
- The report may contain table names and counts, but no passwords.
- This is **not** a complete project migration or a green light to delete the source.
- Do not delete Canada Central until auth identities, functions, cron jobs, storage, secrets, and all skipped tables are reconciled and tested.
