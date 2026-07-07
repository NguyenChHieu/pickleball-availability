# Agent Guide

## Project

Pickleball Availability Buddy is a read-only Chrome extension plus a full-stack Next.js app for cached pickleball venue availability.

## Guardrails

- Keep the project read-only: no booking, payment, checkout, login, waiver, CAPTCHA, or access-control automation.
- Keep extension scraping polite and user-directed.
- Do not put backend secrets, Supabase secret keys, or sync tokens in extension code.
- Preserve the split: extension reads, Next API routes store, share/web UI renders, future bots reply from cached data.

## Current Stack

- `extension/`: plain Chrome MV3 JavaScript.
- `web/`: Next.js App Router app with share pages, API routes, cache/store modules, and webhook handlers.
- Supabase: optional durable availability cache through REST.
- Vercel: current single-app deployment target.

## Planning

GSD planning files live in `.planning/`.

- Read `.planning/PROJECT.md` before larger changes.
- Use `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` for phase scope.
- Prefer `$gsd-ui-phase 1` before implementing the venue-themed availability UI.

## Verification

Run these checks after relevant changes:

```powershell
npm.cmd --prefix web run typecheck
npm.cmd --prefix web run lint
npm.cmd --prefix web run build
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
