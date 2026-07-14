# Project Context

## Current Snapshot

- Path: `C:\Users\nguye\Downloads\propickle-buddy`
- Git branch: `codex/planner-release-qa`
- Git status: planner release QA passed locally and on Vercel preview; do not merge before user preview review.
- Local instructions: `AGENTS.md` plus `.ai/agent-router.md`.

## Stack

- Language/runtime: plain JavaScript for the Chrome extension; TypeScript/React/Node runtime inside the Next app.
- Framework: Chrome Manifest V3 extension; Next.js App Router full-stack web app.
- Package manager: `npm` for `web/`.
- Database/storage: Chrome local extension storage, local Next file cache for dev, Supabase REST cache via `availability_cache` for deployment.
- Test framework: Node TypeScript fixtures plus TypeScript/ESLint/Next build for web; Node unit/syntax checks for extension scripts.
- Deployment/runtime: one Vercel deployment for `web/`; Supabase for durable cache; extension loaded unpacked in Chrome.

## Directory Map

- `extension/`: MV3 popup/options/background/content scripts, venue config, refresh orchestration, booking deep-link helper.
- `extension/providers/`: Playbypoint, ClubSpark, Mindbody, Playtomic, PodPlay, and Hamlet readers.
- `web/app/`: Next.js routes, share page, API routes, webhook routes, and global styles.
- `web/src/components/`: homepage, availability, and planner UI components.
- `web/src/lib/`: public availability loader and venue themes.
- `web/src/server/`: cache store, Supabase REST access, public availability normalizer, planner store/matching, formatter, booking links, Messenger helpers.
- `docs/`: project learning notes and Messenger bot research.
- `.planning/`: GSD project, requirements, roadmap, and phase notes.
- `.ai/`: local agent router, project context, worklog, playbooks, and workflow notes.
- `.ai/playbooks/extension-qa.md`: manual and automated QA checklist for extension refresh, popup, and share-page refresh changes.

## Commands

| Purpose | Command | Notes |
|---|---|---|
| install web | `npm.cmd --prefix web install` | Uses `web/package-lock.json`. |
| dev web | `npm.cmd --prefix web run dev -- --port 3007` | Local share UI and API routes in one app. |
| start web | `npm.cmd --prefix web run start` | Production Next server after `build`. |
| build web | `npm.cmd --prefix web run build` | Next production build. |
| lint web | `npm.cmd --prefix web run lint` | ESLint. |
| typecheck web | `npm.cmd --prefix web run typecheck` | `tsc --noEmit`. |
| health route | `curl http://localhost:3007/health` | Returns `{ "ok": true }` when the Next dev server is running. |
| check extension | `node --check extension\background.js` | Repeat for listed extension scripts after changes. |
| validate manifest | `python -m json.tool extension\manifest.json` | MV3 manifest JSON validity. |
| format | none | No formatter script is configured. |

On this Windows checkout, `npm.cmd --prefix web run build` can fail with `EPERM` while writing
`web/.next/trace*`. If the same source has passed lint/typecheck and the build fails only on that trace
write, rerun the same build with approved filesystem access before treating it as a code failure.

Useful extension checks:

```powershell
node --check extension\background.js
node --check extension\contentScript.js
node --check extension\popup.js
node --check extension\options.js
node --check extension\venues.js
node --check extension\bookingDeepLink.js
node --check extension\providers\playbypointBookBox.js
node --check extension\providers\clubsparkBookByDate.js
node --check extension\providers\mindbodyAppointments.js
node --check extension\providers\playtomicAvailability.js
node --check extension\providers\podplayDom.js
python -m json.tool extension\manifest.json
```

## Architecture Notes

- Main execution path: user manually triggers extension read/refresh, extension reads visible venue availability, Next API route stores latest payload, Next share UI renders cached availability.
- Data flow: booking widget DOM -> content/provider scripts -> background persistence/sync -> `POST /api/availability/:venueId` on the Next app -> local dev cache or Supabase -> `/s/:shareToken/:venueId`, `/api/public/:shareToken/:venueId`, or `/s/:shareToken/:venueId/text`.
- State management: Chrome local storage per venue in extension; one latest cached payload per venue in the Next/Supabase cache; small extension refresh-job history; share page reads cached display data server-side.
- API boundaries: extension never owns server secrets; Next API protects sync with `AVAILABILITY_SYNC_TOKEN`; public share uses unguessable `SHARE_TOKEN`.
- Error handling pattern: preserve last good cached result; distinguish setup-required/login-hidden states from true empty availability; invalid share tokens return 404.
- Logging/observability pattern: Next server logs/dry-run Messenger replies; extension popup presents user-facing status.

## Local Conventions

- Naming: venue IDs are stable lowercase keys such as `propickle`.
- File organization: keep provider-specific scraping in `extension/providers/`; keep venue definitions in `extension/venues.js`; keep web venue styling in `web/src/lib/themes.ts`.
- Component/module pattern: extension is plain JS with no build step; cache/API/webhook logic stays in `web/src/server`; polished share UI belongs in `web/`.
- Test style: focused syntax/test commands per touched layer; browser/manual checks for extension behavior.
- Commit/PR expectations: keep read-only guardrails explicit; use Ponytail review when adding abstractions, dependencies, or large logic.

## Risky Areas

- Auth/security: do not automate login, waiver, CAPTCHA, Cloudflare, booking, payment, checkout, or access-control bypass.
- Persistence/migrations: Supabase schema is in `web/supabase.sql`; deployed Next app requires both `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.
- Secrets: never put Supabase secret keys, sync tokens, or Messenger page tokens in extension code.
- External integrations: Playbypoint DOM can change; Vercel env vars and Supabase REST config are runtime-sensitive.
- Generated files: avoid editing `web/.next/`, `web/node_modules/`, `web/tsconfig.tsbuildinfo`, and extension/browser generated artifacts.
- Release/deploy scripts: Vercel should use `web/` as the root directory and auto-deploy from GitHub.

## Known Pitfalls

- Logged-out Playbypoint pages can show day buttons while hiding time slots; treat this as setup-required, not no availability.
- Popup should show saved data on open and refresh only when the user clicks refresh/read.
- Normal multi-venue refresh should prefer stale-only or cache-first paths; deep provider/court scans stay explicit because North Ryde can be slow.
- Extension refresh changes need manual QA after reloading the unpacked extension: tick venues, run Refresh Selected, verify recent refresh history, then open the share page.
- Share-page header/nav changes need long-name visual QA around laptop/tablet widths such as 1440, 1366, 1200, 967, 768, and mobile.
- Share page reads cached availability only; it must not trigger scraping.
- Future venues should be added through venue/provider/theme configuration before inventing a new scraper flow.
- House of Pickle DH uses a conservative DOM-first PodPlay reader; it reads visible booking rows only and should not create Firebase anonymous identities or call booking/cart APIs.
- WOTSO Pyrmont uses a Hamlet provider from the WOTSO page context; it relies on the page-created guest session and subtracts bookings from court open hours.
- The repo has `.ai/` workflow files; keep them aligned when architecture/deployment decisions change.

## Current Validation Baseline

Planner release branch checked on July 13 before preview publication:

- Web typecheck: `npm.cmd --prefix web run typecheck -- --incremental false` passed.
- Web lint: `npm.cmd --prefix web run lint` passed.
- Web build: `npm.cmd --prefix web run build` passed.
- Web fixtures: 32 tests passed, including planner recovery throttling, secret-field exclusion, and venue matching.
- Local planner smoke: create, save, reload, forget-device, wrong/correct recovery, mobile layout, and `429` throttling passed.
- Code review: no remaining required findings after adding the same-court recommendation tie-breaker.
- Simplicity review: no new abstraction or dependency; the behavior fix is confined to the existing sorter and one regression test.
- Vercel preview: event create/save/reload/recovery, ProPickle cached matching, durable `429`, valid-token bypass, and public secret-field checks passed.
- Extension syntax checks passed for background, content, popup, options, venues, booking deep-link, and all providers.
- Manifest JSON validation passed.

## Agent Notes

- Prefer: work from `C:\Users\nguye\Downloads\propickle-buddy`; read `AGENTS.md` and `.ai/agent-router.md` first; choose FAST/EXPRESS/CONTROLLED from `.ai/agent-router.md`.
- Prefer: keep the extension boring and reliable; push visual polish into `web/`.
- Avoid: adding runtime dependencies or abstractions without a Ponytail review.
- Avoid: product code changes during onboarding/doc-only tasks.
- Ask before: committing `.ai/`, adding new deploy services, changing auth/cache semantics, or expanding beyond read-only behavior.

## Next Exploration Step

Complete planner release QA: fixtures, typecheck, lint, build, normal/private browser recovery journeys, public-response secret inspection, and ProPickle venue matching. Publish a Vercel preview and wait for user review before merging. After that, explore shared-cache reliability and scheduled refresh only for public guest-visible venues.
