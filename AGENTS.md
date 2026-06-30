# Agent Guide

## Project

Pickleball Availability Buddy is a read-only Chrome extension plus Node backend for cached pickleball venue availability.

## Guardrails

- Keep the project read-only: no booking, payment, checkout, login, waiver, CAPTCHA, or access-control automation.
- Keep extension scraping polite and user-directed.
- Do not put backend secrets, Supabase secret keys, or sync tokens in extension code.
- Preserve the split: extension reads, backend stores, share/web UI renders, future bots reply from cached data.

## Current Stack

- `extension/`: plain Chrome MV3 JavaScript.
- `server/`: dependency-free Node CommonJS backend.
- Supabase: optional durable availability cache through REST.
- Render: current backend deployment target.

## Planning

GSD planning files live in `.planning/`.

- Read `.planning/PROJECT.md` before larger changes.
- Use `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` for phase scope.
- Prefer `$gsd-ui-phase 1` before implementing the venue-themed availability UI.

## Verification

Run these checks after relevant changes:

```powershell
npm.cmd --prefix server run check
node --check extension\background.js
node --check extension\contentScript.js
node --check extension\popup.js
node --check extension\options.js
node --check extension\venues.js
node --check extension\bookingDeepLink.js
node --check extension\providers\playbypointBookBox.js
python -m json.tool extension\manifest.json
```
