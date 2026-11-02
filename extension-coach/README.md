# Savant Coach (browser extension)

For career coaches. Open it on a job listing, or on a Google Sheet of listings, and the side
panel says **PASS** or **NO PASS** with the reasons, so a coach knows whether a job is a ghost
listing before recommending it. There is a chat box under the results for follow-up questions.

It never clicks, types or changes a page. It only reads.

## How a check works

```
Side panel ──▶ content.js reads the open page ─┐   (JobPosting markup, "no longer accepting"
                                               │    banners, posted date, Apply button)
Google Sheet ─▶ CSV of the tab (your Google    │
                sign-in) → link column         ▼
                                  POST /api/coach/check   (career_coach or admin only)
                                               │
              ┌────────────────────────────────┼─────────────────────────────────┐
              ▼                                ▼                                 ▼
   Hiring-board lookup               Savant's jobs table                  AI reviewer (optional)
   Greenhouse / Lever / Ashby:       first seen, closed by the            wording problems, each
   is the posting still listed?      scout, same posting reposted         backed by a quote that
                                                                          must exist on the page
              └────────────────────────────────┼─────────────────────────────────┘
                                               ▼
                       src/lib/coach/listing.ts  →  PASS / NO PASS + signals
                       (built on src/lib/scout/ghost.ts, same threshold of 50)
```

**NO PASS** when any hard stop is found (the hiring board no longer lists it, the page says it is
closed, its own expiry date has passed, Savant's scout already closed it, or it asks applicants for
money) or when the ghost score reaches 50. Otherwise **PASS**; its `confidence` says how much
evidence backed that. An unreadable page is a low-confidence PASS that says to check it by hand.

## Sheet mode

Open a Google Sheet tab. The panel reads that tab as CSV through the coach's own Google sign-in
(no extra Google permission), finds the column of job links, and uses the header row to pick up
title, company and location. **Check all** runs the listings in batches of 8; results appear as a
list with filters (All / Pass / No pass), a **Why** drop-down per row, and **Copy as table** (paste
the Pass/No pass column back into the sheet). Or paste links into the box instead.

Limits: only the text in cells is read, so a link hidden behind a label is not seen (paste it, or show
the URL); 200 listings per run; the server fetches sheet-row pages itself, so a page built entirely
in the browser comes back as a low-confidence result.

## Install (unpacked)

1. `node scripts/pack-extension.mjs --dir=extension-coach` writes `public/downloads/savant-coach.zip`.
2. Unzip, open `chrome://extensions`, turn on Developer mode, **Load unpacked**, pick `savant-coach/`.
3. Sign in to savantalent.com as a coach in the same browser. The coach hub hands the extension
   its session automatically (`connectSavantCoachExtension`, mounted in `src/routes/coach/route.tsx`).
4. Click the toolbar icon to open the side panel.

The download's ID is fixed by the public `key` in `manifest.json`: `kflijjonijofojcjkjhakldjfbfkkmlm`
(listed in `src/lib/autofill/extension.ts`). For the Chrome Web Store, run
`node scripts/pack-extension.mjs --dir=extension-coach --store`, then put the store's ID in
`STORE_COACH_ID` (or set `VITE_SAVANT_COACH_EXTENSION_ID`).

## Permissions, and why

| Permission                                                                              | Why                                                                     |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `sidePanel`                                                                             | the panel itself                                                        |
| `tabs`                                                                                  | know which tab is active, so the verdict follows the coach between tabs |
| `scripting`, `activeTab`                                                                | read the open listing, only after the panel is open                     |
| `storage`                                                                               | the session token                                                       |
| `host_permissions` for savantalent.com, Google Sheets, the main ATS and job-board sites | call Savant; read a sheet; read listings without a prompt               |
| `optional_host_permissions` (all sites)                                                 | a company's own careers page: the panel asks per site, once             |

## How coaches find out about it

Same as talent with Savant Apply:

- **Inbox notification** with the install steps and an "Install guide" button, added once per coach
  (migration `20261101000001_coach_extension_notice.sql`: existing coaches now, new coaches when the
  role is granted).
- **Install guide** at `/coach/extension` (`src/routes/coach/extension.tsx`): live "installed and
  connected" status, the five install steps, how to use it, troubleshooting. "Listing Checker" in the
  coach menu.
- **Prompt on the coach home** (`src/components/coach/ExtensionPrompt.tsx`) until it is installed and
  connected; "Not now" hides it in that browser.
- A step in **Getting started** and a Help answer.

## Server

- Migration `supabase/migrations/20261101000000_coach_listing_checks.sql` (audit log + 24h AI cache).
- `POST /api/coach/check` and `POST /api/coach/chat` (`src/routes/api.coach.*.ts`); logic in
  `src/lib/coach/listing.server.ts`. Needs `ANTHROPIC_API_KEY` for the AI reviewer and chat
  (optional `COACH_MODEL`, default `DRAFT_MODEL`, then `claude-sonnet-5`); without it the verdict
  still works on the other signals and chat is unavailable.
- 600 checks per coach per day. The server only fetches public http(s) addresses.

## Test

`node scripts/coach-ghost-test.ts` checks the verdict logic. After changing anything here, bump
`version` in `manifest.json` and re-run the pack script.
