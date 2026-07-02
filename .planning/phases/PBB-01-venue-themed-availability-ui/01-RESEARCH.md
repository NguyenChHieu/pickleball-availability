# Phase 1: Venue-Themed Availability UI - Research

**Researched:** 2026-07-02
**Domain:** Node CommonJS display API + Next.js App Router frontend
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

Copied verbatim from `.planning/phases/PBB-01-venue-themed-availability-ui/01-CONTEXT.md`. [VERIFIED: codebase grep]

### Locked Decisions
## Implementation Decisions

### Display Data Endpoint

- **D-01:** Add a public, share-token-protected display endpoint shaped like `GET /api/public/:shareToken/:venueId`.
- **D-02:** The endpoint returns a display-ready payload, not raw cache. The backend should normalize cached availability into exactly what the web UI needs: venue identity, freshness state, day cards, interval labels, total open hours, and safe booking action URLs.
- **D-03:** Use a hybrid theme model. The endpoint returns a lightweight `themeId` such as `propickle`; the `web/` app owns the full visual theme, including colors, hero behavior, court/ball treatment, copy nuances, and future venue-specific visual assets.
- **D-04:** Endpoint failure behavior should use HTTP status plus display-safe bodies:
  - wrong share token: `404` with a generic body;
  - no cached availability: `404` with `state: "empty"`;
  - valid cached data: `200` with display payload;
  - stale cached data: `200` with display payload plus `isStale: true`;
  - server problem: `500` with a safe generic body.
- **D-05:** Stale threshold is 12 hours. Reads older than 12 hours should return `isStale: true` so the web UI can show the stale warning from the UI-SPEC.

### the agent's Discretion

The agent may choose the exact TypeScript names, route helper names, and display payload module boundaries during planning, as long as the endpoint remains display-safe and does not expose raw slot JSON, sync tokens, Supabase details, or extension storage keys.

### Deferred Ideas (OUT OF SCOPE)
## Deferred Ideas

- Web app routing, extension share-link behavior, motion implementation depth, and deployment path were identified as gray areas but not discussed in this pass.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIEW-01 | Secret-link, phone-friendly venue page. | Use `web/app/s/[shareToken]/[venueId]/page.tsx` backed by `GET /api/public/:shareToken/:venueId`; keep `/s/:shareToken/:venueId` stable. [VERIFIED: codebase grep] [CITED: nextjs.org dynamic routes] |
| VIEW-02 | One section per available day with merged intervals. | Transform cached `days[].open_intervals` into display day cards and interval labels. [VERIFIED: codebase grep] |
| VIEW-03 | Show when cache was last read. | Use `payload.exported_at` first, `record.received_at` fallback, and existing `formatDateTime`. [VERIFIED: codebase grep] |
| VIEW-04 | Open booking page for a specific day. | Factor/share `stripHash` and `bookingUrlForDay`; expose backend-generated safe links. [VERIFIED: codebase grep] |
| THEME-01 | ProPickle brand cues without readability loss. | Implement UI-SPEC colors, type scale, spacing, mobile card contract, and copy. [VERIFIED: 01-UI-SPEC.md] |
| THEME-02 | Theme data separated from rendering logic. | Backend returns `themeId`; `web/` maps it to typed theme tokens. [VERIFIED: 01-CONTEXT.md] |
| THEME-03 | Smooth but non-essential motion. | Prefer CSS first; isolate GSAP/R3F only if justified and reduced-motion safe. [VERIFIED: 01-UI-SPEC.md] [CITED: gsap.com React docs] |
</phase_requirements>

## Summary

Plan this phase as two linked slices: a display-safe backend endpoint and a separate `web/` Next.js TypeScript app that consumes only that endpoint. [VERIFIED: 01-CONTEXT.md] The existing server-rendered `/s/:shareToken/:venueId` route remains the stable fallback and should not be replaced in Phase 1. [VERIFIED: 01-CONTEXT.md]

The backend already has the useful pieces: `shareFromPath`, `validShareToken`, `sendApiJson`, `sendApiPreflight`, `handleSharePage`, `getAvailabilityPayload`, `getAvailabilityRecord`, `formatDateTime`, and share-page booking URL sanitization. [VERIFIED: codebase grep] The missing piece is an explicit public DTO transformer that calculates ready/empty/stale state and allowlists fields for the web UI. [VERIFIED: 01-CONTEXT.md]

The frontend should use App Router dynamic route params, fetch the DTO in a Server Component or server-only helper, map `themeId` to ProPickle theme data locally, and keep any animation/canvas code in isolated Client Components. [CITED: nextjs.org fetching data] [CITED: nextjs.org dynamic routes]

**Primary recommendation:** Build and verify the backend DTO first, scaffold the smallest useful `web/` app second, and add motion polish only after data states, fallback behavior, mobile readability, and read-only constraints pass. [VERIFIED: 01-UI-SPEC.md]

## Project Constraints (from AGENTS.md)

- Keep the project read-only: no booking, payment, checkout, login, waiver, CAPTCHA, or access-control automation. [VERIFIED: AGENTS.md]
- Preserve the split: extension reads, backend stores, share/web UI renders, future bots reply from cached data. [VERIFIED: AGENTS.md]
- Do not put backend secrets, Supabase secret keys, or sync tokens in extension code or public frontend code. [VERIFIED: AGENTS.md]
- Current stack is plain Chrome MV3 JavaScript in `extension/`, dependency-free Node CommonJS in `server/`, optional Supabase durable cache, and Render for the current backend deployment. [VERIFIED: AGENTS.md]
- Required existing check after relevant backend changes is `npm.cmd --prefix server run check`; this passed during research. [VERIFIED: shell]

## Current Architecture Summary

| Area | File/Symbol | What Exists | Planning Implication |
|------|-------------|-------------|----------------------|
| HTTP router | `server/src/index.js:215` `handleRequest` | Small dependency-free Node router. [VERIFIED: codebase grep] | Add `/api/public/...` here without introducing a backend framework. [VERIFIED: AGENTS.md] |
| API JSON/CORS | `server/src/index.js:45` `sendApiJson`; `:66` `sendApiPreflight`; `:17` `API_CORS_HEADERS` | Helpers exist for API JSON/preflight. [VERIFIED: codebase grep] | Extend to `/api/public/` because `web/` may be separate-origin. [VERIFIED: 01-CONTEXT.md] |
| Share token model | `server/src/index.js:125` `shareFromPath`; `:138` `validShareToken` | `/s/:shareToken/:venueId` parsing/validation exists. [VERIFIED: codebase grep] | Reuse token validation; invalid token stays generic 404. [VERIFIED: 01-CONTEXT.md] |
| Fallback HTML | `server/src/index.js:172` `handleSharePage`; `server/src/sharePage.js:71` `renderSharePage` | Current phone-friendly HTML page. [VERIFIED: codebase grep] | Keep stable; do not redesign as part of endpoint work. [VERIFIED: 01-CONTEXT.md] |
| Text/bot formatter | `server/src/formatAvailability.js:1` `formatDateTime`; `:28` `formatAvailability` | Existing date/time and summary formatting. [VERIFIED: codebase grep] | Reuse for freshness and future bot/share consistency. [VERIFIED: ROADMAP.md] |
| Cache store | `server/src/availabilityStore.js:47` `getAvailabilityRecord`; `:59` `getAvailabilityPayload` | Reads local JSON or Supabase. [VERIFIED: codebase grep] | Endpoint should read through store only; `web/` must not access Supabase. [VERIFIED: AGENTS.md] |
| Booking URL safety | `server/src/sharePage.js:25` `stripHash`; `:37` `bookingUrlForDay`; `:41` `renderBookingActions` | Protocol filtering and `#pbb_date=` behavior exist inside HTML renderer. [VERIFIED: codebase grep] | Factor these helpers so API returns safe `bookingUrl` values. [VERIFIED: codebase grep] |
| Venue metadata | `extension/venues.js:8-14` ProPickle config | ProPickle display/start/setup URLs live in extension registry. [VERIFIED: codebase grep] | Add minimal backend public venue metadata or duplicate only safe display fields; do not import extension globals. [ASSUMED] |
| Web app | repo file inventory | No `web/` app exists yet. [VERIFIED: codebase grep] | Plan scaffold, package audit checkpoint, scripts, and env example. [VERIFIED: codebase grep] |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Playbypoint reading | Browser extension | Backend cache | User's normal Chrome session owns access/setup. [VERIFIED: AGENTS.md] |
| Cache persistence | API/backend | Storage | `availabilityStore` owns local/Supabase reads and writes. [VERIFIED: codebase grep] |
| Public display DTO | API/backend | Frontend server | Backend owns token validation, field filtering, freshness, stale state, and safe booking URLs. [VERIFIED: 01-CONTEXT.md] |
| Venue theme visuals | `web/` frontend | Backend DTO | Backend returns `themeId`; `web/` owns colors, hero, copy nuance, and assets. [VERIFIED: 01-CONTEXT.md] |
| Motion/hero effects | Browser client component | Server-rendered markup | GSAP/R3F require client-side APIs and must remain non-essential. [VERIFIED: 01-UI-SPEC.md] |
| Stable fallback | Backend HTML | Browser | Current `/s/...` remains available while `web/` is proven. [VERIFIED: 01-CONTEXT.md] |

## Backend Endpoint Research

Use `GET /api/public/:shareToken/:venueId` and matching `OPTIONS`. [VERIFIED: 01-CONTEXT.md] Add a route parser such as `publicShareFromPath(pathname)` or generalize `shareFromPath`; validate `shareToken` before revealing cache state; call `getAvailabilityRecord(venueId)` so stale logic can use `received_at` if `payload.exported_at` is missing. [VERIFIED: codebase grep]

Create a display transformer module such as `server/src/publicAvailability.js`. [ASSUMED] It should own:

- venue identity and `themeId` mapping, returning `propickle` for ProPickle. [VERIFIED: 01-CONTEXT.md]
- freshness formatting via `formatDateTime`. [VERIFIED: codebase grep]
- stale detection using the locked 12 hour threshold. [VERIFIED: 01-CONTEXT.md]
- interval label construction, e.g. `startTime-endTime`, without exposing raw slots. [VERIFIED: 01-CONTEXT.md]
- safe booking URL generation by factoring `stripHash`/`bookingUrlForDay`. [VERIFIED: codebase grep]
- explicit allowlist DTO construction; never return raw cache records. [VERIFIED: 01-CONTEXT.md]

Recommended DTO:

```ts
type PublicAvailabilityResponse =
  | {
      state: 'ready';
      venueId: string;
      venueName: string;
      themeId: string;
      lastReadAt: string | null;
      freshnessLabel: string;
      isStale: boolean;
      staleThresholdHours: 12;
      summary: { dayCount: number; totalOpenHours: number };
      days: Array<{
        date: string;
        title: string;
        totalOpenHours: number;
        openIntervals: Array<{ startTime: string; endTime: string; label: string }>;
        bookingUrl?: string;
      }>;
      fallbackUrl?: string;
    }
  | { state: 'empty'; message: string; fallbackUrl?: string }
  | { state: 'error'; message: string; fallbackUrl?: string };
```

Behavior implications:

| Case | HTTP | Body | UI |
|------|------|------|----|
| Wrong token | 404 | generic not found | Concise error; no token/venue confirmation. [VERIFIED: 01-CONTEXT.md] |
| No cache | 404 | `state:"empty"` | UI-SPEC empty copy: refresh from extension, no web refresh. [VERIFIED: 01-UI-SPEC.md] |
| Valid cache | 200 | `state:"ready"` | Render hero, freshness, days, intervals, booking links. [VERIFIED: 01-CONTEXT.md] |
| Stale cache | 200 | `isStale:true` | Show stale warning near freshness, keep booking links. [VERIFIED: 01-CONTEXT.md] |
| Server problem | 500 | generic safe body | Hide stack traces, Supabase details, and env names. [VERIFIED: 01-CONTEXT.md] |

## Next.js Web App Research

Create a separate `web/` app rather than rewriting the backend share page. [VERIFIED: 01-CONTEXT.md] The cleanest route is `web/app/s/[shareToken]/[venueId]/page.tsx`, which keeps the public URL shape familiar while letting the deployment target differ from the backend fallback. [ASSUMED]

The page should fetch `GET ${NEXT_PUBLIC_BACKEND_URL}/api/public/${shareToken}/${venueId}` from a Server Component or server-only helper, then pass display-safe data into presentational components. Current Next.js App Router docs support async Server Component fetching with `fetch`, and note that server-side query logic is not bundled to the client, while authorization still remains the developer's responsibility. [CITED: https://nextjs.org/docs/app/getting-started/fetching-data]

Recommended `web/` structure:

| Path | Purpose |
|------|---------|
| `web/package.json` | Isolated Next app scripts and dependencies. |
| `web/next.config.ts` | Minimal Next config; no custom server. |
| `web/tsconfig.json` | Strict enough TypeScript for display DTOs. |
| `web/.env.example` | `NEXT_PUBLIC_BACKEND_URL=http://localhost:8787`. |
| `web/app/s/[shareToken]/[venueId]/page.tsx` | Public venue availability route. |
| `web/app/s/[shareToken]/[venueId]/loading.tsx` | Meaningful route-level loading state. |
| `web/app/s/[shareToken]/[venueId]/not-found.tsx` | Empty/not-found display states. |
| `web/src/lib/publicAvailability.ts` | Fetch wrapper, DTO types, error mapping. |
| `web/src/lib/themes.ts` | `themeId` to venue theme tokens. |
| `web/src/components/AvailabilityPage.tsx` | Semantic page composition. |
| `web/src/components/HeroScene.tsx` | Optional client-only decorative motion/canvas. |
| `web/src/components/DayCard.tsx` | Day title, intervals, hours, booking action. |

Use CSS modules or plain global CSS for this phase. [ASSUMED] Tailwind is not required to prove the architecture, and avoiding a utility framework keeps the first `web/` scaffold easier to review. [ASSUMED]

## UI and Motion Research

The UI-SPEC constrains the experience to a product-like availability page, not a generic landing page. [VERIFIED: 01-UI-SPEC.md] The first viewport should show ProPickle identity, freshness, useful availability summary, and a hint of the day cards below. [VERIFIED: 01-UI-SPEC.md]

Motion should be an enhancement layer:

- Use semantic HTML for all venue name, freshness, days, interval chips, and booking actions. [VERIFIED: 01-UI-SPEC.md]
- Use CSS transitions for chip/card hover and stale/empty states before adding heavier libraries. [ASSUMED]
- If GSAP is added, isolate it in a client component and use the official React helper approach rather than ad hoc DOM timing. [CITED: https://gsap.com/resources/React/]
- If Three.js/R3F is added, keep the canvas decorative and non-blocking; React Three Fiber exposes Three.js through React components but should not own the availability content. [CITED: https://r3f.docs.pmnd.rs/getting-started/introduction]
- Respect `prefers-reduced-motion: reduce`; with reduced motion, no parallax or continuous canvas animation should run. [VERIFIED: 01-UI-SPEC.md]

For a memorable but controlled v1, plan for one client-only hero enhancement after the semantic page works. A good first slice is a lightweight court-line/ball visual with CSS transform or simple canvas/R3F, not an elaborate game scene. [ASSUMED]

## Threat Model Notes

| Threat | Mitigation to Plan |
|--------|--------------------|
| Share token enumeration | Invalid token returns generic `404`; never disclose whether venue exists before token validation. [VERIFIED: 01-CONTEXT.md] |
| Raw cached availability leak | Public endpoint constructs an allowlisted DTO and does not return raw slots, full payloads, Supabase records, sync tokens, or extension storage details. [VERIFIED: 01-CONTEXT.md] |
| Accidental scraping from web app | `web/` fetches only the backend public display endpoint. No Playbypoint URL fetches, browser extension APIs, login automation, or booking API calls. [VERIFIED: AGENTS.md] |
| Unsafe booking URLs | Factor URL sanitization from share page; only allow http/https booking links and append only `#pbb_date=` markers. [VERIFIED: codebase grep] |
| Client-side secret leakage | The share token is intentionally in the public URL, but backend sync token, Supabase secret key, and database credentials must never appear in `web/` env or bundles. [VERIFIED: AGENTS.md] |

## Planner Hints

Plan as three waves:

| Wave | Slice | Why |
|------|-------|-----|
| 1 | Backend public display endpoint and formatter extraction | Gives `web/` a safe, testable contract and preserves fallback route. |
| 2 | Minimal Next.js `web/` app consuming the DTO | Delivers the useful mobile availability page with theme separation. |
| 3 | Motion/brand polish and visual verification | Adds memorable ProPickle feel after the data contract works. |

Likely files to modify:

- `server/src/index.js`
- `server/src/sharePage.js`
- `server/src/formatAvailability.js`
- `server/src/publicAvailability.js` (new)
- `server/src/bookingLinks.js` or similar helper (new)
- `server/package.json` if adding a check script is needed, but avoid runtime dependencies. [ASSUMED]

Likely files to create:

- `web/package.json`
- `web/next.config.ts`
- `web/tsconfig.json`
- `web/.env.example`
- `web/app/layout.tsx`
- `web/app/globals.css`
- `web/app/s/[shareToken]/[venueId]/page.tsx`
- `web/app/s/[shareToken]/[venueId]/loading.tsx`
- `web/app/s/[shareToken]/[venueId]/not-found.tsx`
- `web/src/lib/publicAvailability.ts`
- `web/src/lib/themes.ts`
- `web/src/components/AvailabilityPage.tsx`
- `web/src/components/DayCard.tsx`
- `web/src/components/HeroScene.tsx`

## Validation Architecture

Backend validation:

1. `npm.cmd --prefix server run check`
2. Local smoke start with `SHARE_TOKEN=dev-share` and POST a sample payload to `/api/availability/propickle`.
3. Verify `GET /api/public/dev-share/propickle` returns `200`, `state:"ready"`, `themeId:"propickle"`, `isStale`, `freshnessLabel`, `days[].openIntervals[].label`, and safe `bookingUrl`.
4. Verify `GET /api/public/wrong/propickle` returns `404` and does not reveal cache state.
5. Verify an empty cache path returns `404` with `state:"empty"`.
6. Verify the existing `/s/dev-share/propickle` fallback still renders.

Frontend validation:

1. `npm.cmd --prefix web run lint`
2. `npm.cmd --prefix web run build`
3. Run the web dev server and open `/s/dev-share/propickle` against a local or deployed backend.
4. Browser-check desktop and mobile widths for non-overlapping text, visible interval chips, stale/empty states, and booking actions.
5. If `HeroScene` uses canvas/Three.js, verify the canvas is nonblank, framed correctly, does not cover content, and pauses/reduces motion when reduced motion is enabled.

Security/read-only validation:

1. Search `web/` for `SUPABASE`, `AVAILABILITY_SYNC_TOKEN`, `booking_waiver`, `chrome.`, and Playbypoint scraping selectors; none should appear except in docs/comments if explicitly harmless.
2. Confirm booking actions are plain links and do not select times, players, checkout, payment, login, waiver, or CAPTCHA.

## Risks and Unknowns

- Package install requires network and may need user approval in the Codex sandbox. Plan should make dependency additions explicit. [ASSUMED]
- Deployment may be split: Render currently hosts the backend, while `web/` may later deploy to Vercel/Render static Node. Phase 1 should not require final deployment migration. [VERIFIED: 01-CONTEXT.md]
- Existing extension share-link behavior may still point at backend `/s/...`; updating extension to point at the polished web app can be a follow-up unless explicitly included. [VERIFIED: 01-CONTEXT.md]
- The exact ProPickle visual asset strategy is not locked. Avoid relying on external image URLs for core usability. [ASSUMED]

## RESEARCH COMPLETE
