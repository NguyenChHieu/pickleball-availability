---
phase: PBB-01-venue-themed-availability-ui
plan: 01
subsystem: api
tags: [node, commonjs, public-api, availability, share-token]

requires:
  - phase: existing-extension-backend-cache
    provides: cached venue availability records and existing share-token model
provides:
  - GET /api/public/:shareToken/:venueId display-safe availability JSON
  - Shared safe booking-link helpers for HTML fallback and JSON DTOs
  - Node test coverage for public DTO, stale state, empty state, route token behavior, and safe booking links
affects: [web, share-page, bot-ready-formatters, multi-venue]

tech-stack:
  added: []
  patterns:
    - allowlisted backend DTO builder
    - shared booking URL sanitizer
    - in-process node:test endpoint smoke test

key-files:
  created:
    - server/src/bookingLinks.js
    - server/src/publicAvailability.js
    - server/test/publicAvailability.test.js
  modified:
    - server/package.json
    - server/src/index.js
    - server/src/sharePage.js

key-decisions:
  - "Expose public availability through an allowlisted DTO instead of raw cache records."
  - "Reuse one booking-link sanitizer for both the old HTML share page and new public JSON."
  - "Validate share tokens before cache lookup and keep invalid public links as generic 404 responses."

patterns-established:
  - "Public API routes call buildPublicAvailabilityResponse only after share-token validation."
  - "Booking actions are generated server-side from sanitized http/https URLs and encoded pbb_date markers."
  - "Public endpoint tests run against a temporary local cache directory, not the real cache or Supabase."

requirements-completed: [VIEW-01, VIEW-02, VIEW-03, VIEW-04, THEME-02]

duration: 25min
completed: 2026-07-02
---

# Phase 1 Plan 01: Backend Public DTO Endpoint Summary

**Display-safe ProPickle availability JSON endpoint with shared booking-link sanitation and route-level share-token tests**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-02T16:45:00+10:00
- **Completed:** 2026-07-02T17:09:33+10:00
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `GET /api/public/:shareToken/:venueId` with the same secret-link model as the existing share page.
- Added a display-ready DTO that exposes only venue, freshness, day, interval, summary, stale, fallback, and safe booking-link fields.
- Moved booking URL safety logic into a shared helper so the current HTML fallback and future web UI use the same behavior.
- Added Node tests covering ready, stale, empty, safe-link, leak-guard, wrong-token, public endpoint, and CORS preflight behavior.

## Task Commits

1. **Task 1: Create backend public DTO contract tests before implementation** - `91ca2d7` (test)
2. **Task 2: Implement allowlisted public availability DTO and shared safe booking links** - `0de900d` (feat)
3. **Task 3: Wire GET and OPTIONS /api/public/:shareToken/:venueId** - `f6893ac` (feat)

## Files Created/Modified

- `server/src/bookingLinks.js` - Shared `stripHash`, `bookingUrlForDay`, and `bookingActionUrlForDay` helpers.
- `server/src/publicAvailability.js` - Allowlisted public DTO builder with 12 hour stale threshold.
- `server/test/publicAvailability.test.js` - Node test coverage for DTO and endpoint behavior.
- `server/src/index.js` - Public endpoint parser, handler, CORS preflight, safe error body, and testable exports.
- `server/src/sharePage.js` - Existing HTML fallback now uses the shared booking action helper.
- `server/package.json` - Added public test script and syntax checks for new modules.

## Decisions Made

- Public JSON intentionally returns `themeId` rather than full theme tokens; the web app will own theme rendering.
- Empty cache is a display-safe 404 state, while stale cache remains a 200 ready state with `isStale: true`.
- Invalid share tokens use the existing generic 404 body and validate before any cache lookup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added route-level public endpoint coverage**
- **Found during:** Task 3 (Wire GET and OPTIONS public endpoint)
- **Issue:** The plan's module tests covered DTO behavior, but route token ordering and CORS behavior needed direct coverage.
- **Fix:** Added an in-process HTTP server test using a temporary cache directory.
- **Files modified:** `server/test/publicAvailability.test.js`, `server/src/index.js`
- **Verification:** `npm.cmd --prefix server run test:public`
- **Committed in:** `f6893ac`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Strengthened security-sensitive endpoint verification without adding runtime dependencies or changing scope.

## Issues Encountered

- Source leak scan matched existing protected sync-token handling in `server/src/index.js`; no public DTO leak was found.

## User Setup Required

None - no external service configuration required.

## Verification

- `npm.cmd --prefix server run test:public` - passed, 5 tests.
- `npm.cmd --prefix server run check` - passed.
- `Select-String -Path server/src/publicAvailability.js,server/src/index.js -Pattern 'SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|AVAILABILITY_SYNC_TOKEN|x-sync-token|chrome\.|availability:venue:'` - only matched pre-existing protected sync-token code in `server/src/index.js`.

## Next Phase Readiness

Plan 02 can scaffold the separate `web/` Next.js TypeScript app and read `GET /api/public/:shareToken/:venueId` without inspecting raw cache records, sync headers, extension storage, or Supabase details.

## Self-Check: PASSED

---
*Phase: PBB-01-venue-themed-availability-ui*
*Completed: 2026-07-02*
