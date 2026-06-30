# Project State

Last activity: 2026-06-30 - Initialized GSD planning from current repo state.

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-30)

**Core value:** Show trustworthy open booking intervals quickly without manually clicking every booking day.
**Current focus:** Phase 1 - Venue-Themed Availability UI

## Current Status

- Existing ProPickle extension/backend/share flow works.
- Backend can persist availability through Supabase.
- Share page currently uses server-rendered HTML from `server/src/sharePage.js`.
- Popup no longer auto-refreshes on open; refresh is user-directed.
- Next planning focus is venue-themed availability UX and whether to introduce a separate `web/` Next.js TypeScript app.

## Active Phase

Phase 1: Venue-Themed Availability UI

## Recent Decisions

| Date | Decision | Reason |
|------|----------|--------|
| 2026-06-30 | Keep extension plain JavaScript for now | Extension should stay reliable and low-friction |
| 2026-06-30 | Explore polished UI outside extension | Visual polish belongs in share/web UI, not the scraper |
| 2026-06-30 | Initialize GSD manually from current state | Repo is small enough to skip a heavyweight codebase map |

## Blockers/Concerns

- Need inspect Broadway/North Ryde booking pages before assuming they use the same Playbypoint BookBox provider.
- Next.js migration should not happen as a broad rewrite; prefer a small `web/` slice if chosen.
- Motion libraries should not obscure availability data or create mobile performance issues.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|

## Next Step

Run `$gsd-ui-phase 1` or discuss Phase 1 manually to define the venue-themed availability UI.
