# Project Context

## Current Snapshot

- Path: `C:\Users\nguye\Downloads\propickle-buddy`
- Git branch: `feature/second-venue`
- Git status: active migration toward a single full-stack Next.js deployment.
- Local instructions: `AGENTS.md` plus `.ai/agent-router.md`.

## Stack

- Language/runtime: plain JavaScript for the Chrome extension; TypeScript/React/Node runtime inside the Next app.
- Framework: Chrome Manifest V3 extension; Next.js App Router full-stack web app.
- Package manager: `npm` for `web/`.
- Database/storage: Chrome local extension storage, local Next file cache for dev, Supabase REST cache via `availability_cache` for deployment.
- Test framework: TypeScript/ESLint/Next build for web; syntax checks for extension scripts.
- Deployment/runtime: one Vercel deployment for `web/`; Supabase for durable cache; extension loaded unpacked in Chrome.

## Directory Map

- `extension/`: MV3 popup/options/background/content scripts, venue config, Playbypoint provider, booking deep-link helper.
- `extension/providers/`: Playbypoint `BookBox` reader.
- `web/app/`: Next.js routes, share page, API routes, webhook routes, and global styles.
- `web/src/components/`: availability page/card UI components.
- `web/src/lib/`: public availability loader and venue themes.
- `web/src/server/`: cache store, Supabase REST access, public availability normalizer, formatter, booking links, Messenger helpers.
- `docs/`: project learning notes and Messenger bot research.
- `.planning/`: GSD project, requirements, roadmap, and phase notes.
- `.ai/`: local agent router, project context, worklog, playbooks, and workflow notes.

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

Useful extension checks:

```powershell
node --check extension\background.js
node --check extension\contentScript.js
node --check extension\popup.js
node --check extension\options.js
node --check extension\venues.js
node --check extension\bookingDeepLink.js
node --check extension\providers\playbypointBookBox.js
python -m json.tool extension\manifest.json
```

## Architecture Notes

- Main execution path: user manually triggers extension read/refresh, extension reads visible Playbypoint availability, Next API route stores latest payload, Next share UI renders cached availability.
- Data flow: Playbypoint DOM -> content/provider scripts -> background persistence/sync -> `POST /api/availability/:venueId` on the Next app -> local dev cache or Supabase -> `/s/:shareToken/:venueId`, `/api/public/:shareToken/:venueId`, or `/s/:shareToken/:venueId/text`.
- State management: Chrome local storage per venue in extension; one latest cached payload per venue in the Next/Supabase cache; share page reads cached display data server-side.
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
- Share page reads cached availability only; it must not trigger scraping.
- Future venues should be added through venue/provider/theme configuration before inventing a new scraper flow.
- The repo has `.ai/` workflow files; keep them aligned when architecture/deployment decisions change.

## Current Validation Baseline

Last checked during the latest UI work before this onboarding update:

- Web typecheck: `npm.cmd --prefix web run typecheck` passed.
- Web lint: `npm.cmd --prefix web run lint` passed.
- Web build: `npm.cmd --prefix web run build` passed.
- UI smoke: local Playwright desktop/mobile page checks passed for the ProPickle share page before the single-app migration.

Not rerun during this onboarding update:

- Extension syntax checks.
- Manifest JSON validation.

## Agent Notes

- Prefer: work from `C:\Users\nguye\Downloads\propickle-buddy`; read `AGENTS.md` and `.ai/agent-router.md` first; choose FAST/EXPRESS/CONTROLLED from `.ai/agent-router.md`.
- Prefer: keep the extension boring and reliable; push visual polish into `web/`.
- Avoid: adding runtime dependencies or abstractions without a Ponytail review.
- Avoid: product code changes during onboarding/doc-only tasks.
- Ask before: committing `.ai/`, adding new deploy services, changing auth/cache semantics, or expanding beyond read-only behavior.

## Next Exploration Step

Start Phase 2 by researching the next target venue, preferably Broadway Pickleball or North Ryde. Confirm whether it is Playbypoint-compatible, then add it through `extension/venues.js`, host permissions, a venue theme in `web/src/lib/themes.ts`, and focused extension/web validation.
