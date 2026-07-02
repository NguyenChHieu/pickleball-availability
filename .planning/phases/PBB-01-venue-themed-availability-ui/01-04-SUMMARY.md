---
phase: PBB-01-venue-themed-availability-ui
plan: 04
subsystem: ui
tags: [nextjs, react, css, responsive-ui, browser-verification]

requires:
  - phase: PBB-01-venue-themed-availability-ui
    provides: Plan 03 dynamic web route, public DTO fetcher, theme tokens, and semantic day cards
provides:
  - Package-free decorative ProPickle hero scene
  - Final responsive card, state, focus, and reduced-motion styling
  - Browser verification evidence for ready, stale, empty, invalid-link, desktop, mobile, and 360px layouts
affects: [web, ui-polish, multi-venue-themes, deployment]

tech-stack:
  added: []
  patterns:
    - package-free client hero enhancement
    - visible-element browser geometry checks
    - safe not-found rendering through display-state UI

key-files:
  created:
    - web/src/components/HeroScene.tsx
  modified:
    - web/app/globals.css
    - web/app/s/[shareToken]/[venueId]/page.tsx
    - web/src/components/AvailabilityPage.tsx
    - web/src/components/DayCard.tsx
    - web/src/lib/themes.ts

key-decisions:
  - "Use a lightweight CSS/DOM court and ball hero instead of adding GSAP, Three.js, canvas, or another animation package."
  - "Render invalid share links as the safe page error state instead of throwing notFound after streaming starts."
  - "Keep Open booking links as plain external anchors with backend-provided day markers and no booking automation."

patterns-established:
  - "HeroScene is decorative, aria-hidden, reduced-motion aware, and isolated from availability data."
  - "DayCard renders day, title, hours, intervals, and Open booking in the UI-SPEC order."
  - "Browser verification records geometry, overflow, link dimensions, state copy, and no-canvas checks."

requirements-completed: [VIEW-01, VIEW-02, VIEW-03, VIEW-04, THEME-01, THEME-02, THEME-03]

duration: 35min
completed: 2026-07-02
---

# Phase 1 Plan 04: Polish and Browser Verification Summary

**Package-free ProPickle hero polish with responsive day cards, safe invalid-link rendering, and browser-verified cached availability states**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-02T17:50:00+10:00
- **Completed:** 2026-07-02T18:07:00+10:00
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added a decorative ProPickle court and ball hero that uses CSS transforms, no canvas, no animation packages, and reduced-motion safeguards.
- Refined day cards to match the UI-SPEC order: day/date, sublabel, open hours, interval chips, then Open booking.
- Tightened mobile and desktop layout so the first availability card is visible in the first viewport and 360px layout has no horizontal overflow.
- Verified ready, stale, empty, no-interval, invalid-link, desktop, mobile, 360px, focus CSS, safe booking links, and no-canvas states against a real local backend DTO.

## Task Commits

1. **Task 1: Add a lightweight ProPickle hero scene without new packages** - `ab3cc4f` (feat)
2. **Task 2: Finish responsive states, cards, and accessibility polish** - `ab3cc4f` (feat)
3. **Task 3: Run desktop, mobile, stale, empty, and reduced-motion browser verification** - `5d41cd7` (fix found during verification)

## Files Created/Modified

- `web/src/components/HeroScene.tsx` - Decorative, reduced-motion-aware court and ball hero enhancement.
- `web/src/components/AvailabilityPage.tsx` - Places the hero scene inside the branded hero band and keeps semantic availability content outside it.
- `web/src/components/DayCard.tsx` - Renders card content in UI-SPEC order with plain Open booking links after interval chips.
- `web/src/lib/themes.ts` - Splits safe error heading/body copy to avoid duplicated text.
- `web/app/globals.css` - Final hero, responsive layout, day-card, action, focus, state, and reduced-motion styling.
- `web/app/s/[shareToken]/[venueId]/page.tsx` - Renders invalid share links through the safe error state instead of a streaming not-found throw.

## Decisions Made

- Skipped GSAP, Framer Motion, Three.js, and canvas for Phase 1 because CSS/DOM gave enough brand feel without adding bundle, verification, or mobile-performance risk.
- Kept hero motion scroll-reactive only when `prefers-reduced-motion` is not set; reduced-motion users get static court/ball treatment.
- Changed invalid-token handling in the web route to a display-safe error card because the backend public endpoint still owns the true generic 404 boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Invalid share links stayed on the loading UI in Next dev**
- **Found during:** Task 3 (browser verification)
- **Issue:** Calling `notFound()` after the async public DTO fetch caused the route to remain on the streaming loading UI in the local Next dev server for `/s/wrong/propickle`.
- **Fix:** Removed the `notFound()` throw and let `AvailabilityPage` render the existing safe `state: "not-found"` error card.
- **Files modified:** `web/app/s/[shareToken]/[venueId]/page.tsx`
- **Verification:** Browser check for `/s/wrong/propickle` at 390x844 showed `We could not load this share page.` and no horizontal overflow.
- **Committed in:** `5d41cd7`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fixed a user-visible invalid-link bug without changing backend token validation, public DTO shape, or read-only boundaries.

## Issues Encountered

- Browser API did not expose reduced-motion media emulation. Reduced-motion safety was verified by live CSS rule detection plus source checks: `HeroScene` exits early when `matchMedia("(prefers-reduced-motion: reduce)")` matches, and CSS removes hero transforms under `prefers-reduced-motion`.
- Next dev logged a cross-origin HMR warning when the test browser used `127.0.0.1`; the rendered page and checks still completed successfully.

## Browser Verification Evidence

- Ready desktop 1440x900: `ProPickle` title visible, hero height 522px, first card top 494px, 3 day cards, 3 Open booking links, no horizontal overflow, no canvas.
- Ready mobile 390x844: first card top 377px, 3 cards, Open booking links are 44px high and 309px wide, no horizontal overflow, no canvas.
- Narrow 360x760: first card top 343px, scroll width 345px, no horizontal overflow, all Open booking links remain full-width and 44px high.
- Empty state: `No cached availability yet` and extension refresh guidance visible in the first card position.
- Stale state: `This is an older read. Open booking to confirm live availability before making plans.` visible near freshness.
- Invalid link: `We could not load this share page.` and `Check the link or try the stable fallback page.` visible, with no booking links and no overflow.
- No-interval day: seeded `Sat 04 Jul` card rendered `No open intervals` while keeping the Open booking link available.

## User Setup Required

None - no external service configuration required.

## Verification

- `npm.cmd --prefix server run check` - passed.
- `npm.cmd --prefix server run test:public` - passed, 5 tests.
- `npm.cmd --prefix web run typecheck` - passed.
- `npm.cmd --prefix web run lint` - passed.
- `npm.cmd --prefix web run build` - passed.
- Web source safety gate for `canvas`, `three`, `@react-three`, `gsap`, `framer-motion`, `SUPABASE`, `AVAILABILITY_SYNC_TOKEN`, `x-sync-token`, `chrome.`, `/api/availability`, `querySelector`, `checkout`, `payment`, `captcha`, `waiver`, and `login` - passed with no matches in source files.
- Browser verification used local backend `http://127.0.0.1:8791` and web dev server `http://127.0.0.1:3007` with isolated temporary cache data.

## Next Phase Readiness

Phase 1 is complete. The polished `web/` route is ready for deployment-path discussion and Phase 2 venue integration planning. Future venue work can add theme tokens and provider configuration without changing the read-only web rendering contract.

## Self-Check: PASSED

---
*Phase: PBB-01-venue-themed-availability-ui*
*Completed: 2026-07-02*
