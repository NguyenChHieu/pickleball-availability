---
phase: PBB-01-venue-themed-availability-ui
plan: 03
subsystem: ui
tags: [nextjs, app-router, availability, theming, css]

requires:
  - phase: PBB-01-venue-themed-availability-ui
    provides: Plan 01 public DTO endpoint and Plan 02 web scaffold
provides:
  - Dynamic web route at /s/[shareToken]/[venueId]
  - Public DTO fetch wrapper and typed availability states
  - ProPickle theme tokens, availability page shell, and semantic day cards
affects: [web, ui-polish, browser-verification, deployment]

tech-stack:
  added: []
  patterns:
    - server-side fetch wrapper with cache no-store
    - frontend theme token mapping by backend themeId
    - semantic section-per-day card rendering

key-files:
  created:
    - web/app/s/[shareToken]/[venueId]/loading.tsx
    - web/app/s/[shareToken]/[venueId]/not-found.tsx
    - web/app/s/[shareToken]/[venueId]/page.tsx
    - web/next-env.d.ts
    - web/src/components/AvailabilityPage.tsx
    - web/src/components/DayCard.tsx
    - web/src/lib/publicAvailability.ts
    - web/src/lib/themes.ts
  modified:
    - web/app/globals.css
    - web/next.config.ts
    - web/tsconfig.json

key-decisions:
  - "The web route fetches only GET /api/public/:shareToken/:venueId and never calls raw sync endpoints."
  - "Theme visuals live in typed frontend theme data selected by backend themeId."
  - "Day cards render backend-provided bookingUrl values as plain external links only."

patterns-established:
  - "AvailabilityPage handles ready, empty, error, no-days, stale, and footer states from the public DTO."
  - "DayCard uses semantic section and h2 markup with interval chips and a real Open booking link."
  - "Next route params are awaited and the route is force-dynamic so share tokens are not baked at build time."

requirements-completed: [VIEW-01, VIEW-02, VIEW-03, VIEW-04, THEME-01, THEME-02, THEME-03]

duration: 35min
completed: 2026-07-02
---

# Phase 1 Plan 03: Web Route Rendering Summary

**Dynamic ProPickle share route that renders display-safe cached availability with typed theme tokens and semantic day cards**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-02T17:14:00+10:00
- **Completed:** 2026-07-02T17:49:31+10:00
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Added `web/app/s/[shareToken]/[venueId]/page.tsx` as a dynamic App Router share page.
- Added `fetchPublicAvailability` with typed ready, empty, not-found, and error states.
- Added typed ProPickle theme data and reusable `getVenueTheme(themeId)`.
- Added `AvailabilityPage` and `DayCard` components with semantic sections, interval chips, total hours, stale warning, empty/no-days/error states, and plain external `Open booking` links.
- Extended CSS for black hero, light availability section, 8px cards, 999px chips, 44px actions, wrapping mobile layout, and no horizontal-scroll-friendly constraints.

## Task Commits

1. **Task 1: Add the public DTO fetcher and dynamic share route** - `473cf2f` (feat)
2. **Task 2: Render semantic availability cards with typed ProPickle theme data** - `36dcbf1` (feat)

## Files Created/Modified

- `web/src/lib/publicAvailability.ts` - DTO types and server-side public endpoint fetcher.
- `web/app/s/[shareToken]/[venueId]/page.tsx` - Dynamic share route.
- `web/app/s/[shareToken]/[venueId]/loading.tsx` - Stable loading shell.
- `web/app/s/[shareToken]/[venueId]/not-found.tsx` - Safe invalid-link state.
- `web/src/lib/themes.ts` - ProPickle theme tokens and theme lookup.
- `web/src/components/AvailabilityPage.tsx` - Hero, summary, states, day list, stale warning, and footer.
- `web/src/components/DayCard.tsx` - Per-day section, interval chips, total hours, and booking link.
- `web/app/globals.css` - Route/page/card responsive styling.
- `web/next.config.ts` - Turbopack root pinned to the app directory.
- `web/tsconfig.json` and `web/next-env.d.ts` - Next 16 build-supported TypeScript setup.

## Decisions Made

- Empty and backend-error states render through `AvailabilityPage`; generic invalid-token 404 uses `notFound()` and the route not-found UI.
- The hero is static in this plan; Plan 04 can add optional motion after browser verification.
- `web/next.config.ts` pins `turbopack.root` to avoid parent-lockfile root inference on this Windows machine.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Split not-found and error DTO union types**
- **Found during:** Task 1 (Add public DTO fetcher and dynamic share route)
- **Issue:** A combined `state: "error" | "not-found"` type prevented TypeScript from narrowing the ready state in the route.
- **Fix:** Split `PublicAvailabilityError` and `PublicAvailabilityNotFound` into separate union members.
- **Files modified:** `web/src/lib/publicAvailability.ts`
- **Verification:** `npm.cmd --prefix web run typecheck`
- **Committed in:** `473cf2f`

**2. [Rule 3 - Blocking] Accepted Next 16 TypeScript adjustments and pinned Turbopack root**
- **Found during:** Task 2 (Render semantic availability cards)
- **Issue:** `next build` updated `tsconfig.json`, generated `next-env.d.ts`, and warned that a parent lockfile could be inferred as the workspace root.
- **Fix:** Kept the Next-supported TypeScript changes and set `turbopack.root` in `web/next.config.ts`.
- **Files modified:** `web/tsconfig.json`, `web/next-env.d.ts`, `web/next.config.ts`
- **Verification:** `npm.cmd --prefix web run build`
- **Committed in:** `36dcbf1`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both were required for reliable typechecking/building. No new dependencies or extra data surfaces were added.

## Issues Encountered

- A broad file listing accidentally traversed `web/node_modules` during exploration; it was read-only output noise and caused no file changes.

## User Setup Required

None - no external service configuration required.

## Verification

- `npm.cmd --prefix web run typecheck` - passed.
- `npm.cmd --prefix web run lint` - passed.
- `npm.cmd --prefix web run build` - passed.
- Build output shows `/s/[shareToken]/[venueId]` as dynamic server-rendered on demand.
- Source safety gate found no `SUPABASE`, `AVAILABILITY_SYNC_TOKEN`, `x-sync-token`, `chrome.`, `/api/availability`, selector, checkout, payment, captcha, or waiver strings in source files.
- Source check found exactly one `/api/public/` construction point in `web/src/lib/publicAvailability.ts`.

## Next Phase Readiness

Plan 04 can focus on polish and browser verification: run the page against seeded data, check mobile/desktop screenshots, verify no overlap, and decide whether a lightweight static or motion hero enhancement is worth it.

## Self-Check: PASSED

---
*Phase: PBB-01-venue-themed-availability-ui*
*Completed: 2026-07-02*
