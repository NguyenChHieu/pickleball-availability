---
phase: PBB-01-venue-themed-availability-ui
plan: 02
subsystem: ui
tags: [nextjs, react, typescript, eslint, css]

requires:
  - phase: PBB-01-venue-themed-availability-ui
    provides: Plan 01 public availability DTO endpoint and display-safe web data boundary
provides:
  - Isolated web/ Next.js TypeScript app scaffold
  - Approved direct dependency boundary and lockfile
  - Root layout metadata and UI-SPEC baseline global CSS
affects: [web, route-rendering, ui-polish, deployment]

tech-stack:
  added:
    - next
    - react
    - react-dom
    - typescript
    - eslint
    - eslint-config-next
    - "@types/node"
    - "@types/react"
    - "@types/react-dom"
  patterns:
    - separate web app boundary
    - native Next flat ESLint config
    - UI tokens in app/globals.css

key-files:
  created:
    - web/.env.example
    - web/eslint.config.mjs
    - web/next.config.ts
    - web/package-lock.json
    - web/package.json
    - web/tsconfig.json
    - web/app/globals.css
    - web/app/layout.tsx
  modified:
    - .gitignore

key-decisions:
  - "Keep web/ isolated from extension and server code while sharing only the public backend URL contract."
  - "Use native eslint-config-next flat config exports for the installed Next 16 package set."
  - "Establish UI-SPEC colors, type scale, focus rings, touch target, and reduced-motion rules globally before route components."

patterns-established:
  - "web/package.json owns frontend scripts and dependencies; server package scripts remain untouched."
  - "web/.env.example documents only NEXT_PUBLIC_BACKEND_URL and no secrets."
  - "Global CSS defines theme-capable variables that later route components can consume without hard-coded component branches."

requirements-completed: [VIEW-01, THEME-01, THEME-02, THEME-03]

duration: 25min
completed: 2026-07-02
---

# Phase 1 Plan 02: Web Scaffold Summary

**Isolated Next.js TypeScript app with approved package boundary, safe env example, and ProPickle UI-SPEC global CSS foundation**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-02T17:11:00+10:00
- **Completed:** 2026-07-02T17:36:37+10:00
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Created a separate `web/` app boundary beside `extension/` and `server/`.
- Added Next/React/TypeScript/ESLint scripts and lockfile with no Supabase, scraping, extension, auth, booking, payment, or motion dependencies.
- Added `NEXT_PUBLIC_BACKEND_URL=http://localhost:8787` as the only env example value.
- Added root metadata and global CSS tokens for ProPickle black/white, electric blue, pickleball green, muted/border/warning states, focus rings, touch targets, and reduced motion.

## Task Commits

1. **Task 1: Scaffold package, TypeScript, ESLint, and env files** - `fa9a96e` (feat)
2. **Task 2: Add root layout and UI-SPEC baseline CSS** - `09beb90` (feat)

## Files Created/Modified

- `.gitignore` - Ignores frontend generated files: `node_modules/`, `.next/`, and `*.tsbuildinfo`.
- `web/package.json` - Private Next app scripts: `dev`, `build`, `lint`, `typecheck`.
- `web/package-lock.json` - Resolved npm dependency tree.
- `web/next.config.ts` - Minimal typed Next config.
- `web/tsconfig.json` - Strict TypeScript config with `@/*` alias to `src/*`.
- `web/eslint.config.mjs` - Native flat config using `eslint-config-next` exports.
- `web/.env.example` - Public backend URL example only.
- `web/app/layout.tsx` - Root layout, metadata, and global stylesheet import.
- `web/app/globals.css` - UI-SPEC global reset, design tokens, type helpers, focus rings, touch target helper, and reduced-motion rules.

## Decisions Made

- Left route components out of this plan so Plan 03 can add the public DTO fetch/render path cleanly.
- Used the installed Next 16 native flat ESLint config exports rather than the older `FlatCompat` wrapper.
- Kept package specs as the approved package names and relied on `package-lock.json` for resolved versions. Resolved key packages: Next 16.2.10, React 19.2.7, TypeScript 6.0.3, ESLint 9.39.4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched ESLint config to native flat exports**
- **Found during:** Task 1 (Scaffold package, TypeScript, ESLint, and env files)
- **Issue:** The initial `FlatCompat` config failed under installed `eslint-config-next@16.2.10` with a circular JSON validation error.
- **Fix:** Imported `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` directly in `web/eslint.config.mjs`.
- **Files modified:** `web/eslint.config.mjs`
- **Verification:** `npm.cmd --prefix web run lint`
- **Committed in:** `fa9a96e`

**2. [Rule 3 - Blocking] Added frontend generated-file ignores**
- **Found during:** Task 1 (Scaffold package, TypeScript, ESLint, and env files)
- **Issue:** The repo did not ignore nested `node_modules` or TypeScript build-info output, so npm/typecheck generated thousands of stageable files.
- **Fix:** Added `node_modules/`, `.next/`, and `*.tsbuildinfo` to `.gitignore`.
- **Files modified:** `.gitignore`
- **Verification:** `git ls-files --others --exclude-standard web .gitignore` listed only source/config/lockfile files.
- **Committed in:** `fa9a96e`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both were required to keep the scaffold lintable and the repository clean. No extra runtime packages or route behavior were added.

## Issues Encountered

- First npm install attempt timed out and left a partial `web/node_modules`; the partial generated folder was removed and the install was rerun successfully with `npm.cmd --prefix web install --no-audit --no-fund`.

## User Setup Required

None - no external service configuration required.

## Verification

- `npm.cmd --prefix web run typecheck` - passed.
- `npm.cmd --prefix web run lint` - passed.
- Dependency audit - direct dependencies are exactly `next`, `react`, `react-dom`; direct dev dependencies are exactly `@types/node`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next`, `typescript`.
- Env gate - `web/.env.example` contains no `SUPABASE`, `AVAILABILITY_SYNC_TOKEN`, `x-sync-token`, `DATABASE_URL`, or `SECRET`.
- Source gate - `web/` scaffold contains no `chrome.`, `booking_waiver`, Playbypoint selector, or scraping strings.

## Next Phase Readiness

Plan 03 can add `web/app/s/[shareToken]/[venueId]/page.tsx`, DTO fetching, theme mapping, availability page composition, and day cards on top of this scaffold.

## Self-Check: PASSED

---
*Phase: PBB-01-venue-themed-availability-ui*
*Completed: 2026-07-02*
