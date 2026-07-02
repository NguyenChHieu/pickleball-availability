# Phase 1: Venue-Themed Availability UI - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the first polished ProPickle availability experience as a separate `web/` Next.js TypeScript app that runs alongside the existing backend share page. The app displays cached availability only; it does not scrape, refresh, log in, book, pay, or bypass access controls.

</domain>

<decisions>
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope And Product Decisions

- `.planning/PROJECT.md` - project guardrails, product direction, and read-only constraints.
- `.planning/REQUIREMENTS.md` - Phase 1 requirements `VIEW-01` through `THEME-03`.
- `.planning/ROADMAP.md` - Phase 1 success criteria and boundaries.
- `.planning/notes/venue-themed-web-app-direction.md` - exploration decisions for the separate `web/` app, fallback share page, scroll-reactive hero, and public display endpoint.
- `.planning/phases/PBB-01-venue-themed-availability-ui/01-UI-SPEC.md` - approved visual, motion, copy, accessibility, and data contract for Phase 1.

### Existing Implementation

- `server/src/index.js` - current HTTP route handling, share-token validation, sync-token protection, CORS helper, and stable `/s/:shareToken/:venueId` fallback routes.
- `server/src/sharePage.js` - current server-rendered availability semantics: venue name, freshness, day cards, interval chips, and `Open booking` action.
- `server/src/formatAvailability.js` - existing formatter helpers for dates, intervals, and bot-style text.
- `server/src/availabilityStore.js` - cache read/write abstraction for local file storage and Supabase.
- `extension/venues.js` - current venue metadata and ProPickle booking/setup URLs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `server/src/index.js` already has `shareFromPath`, `validShareToken`, `sendApiJson`, `sendApiPreflight`, and `handleSharePage`; the public endpoint should reuse the same token model and JSON response helpers.
- `server/src/sharePage.js` already has safe booking URL construction through `stripHash`, `bookingUrlForDay`, and `renderBookingActions`; the display endpoint should expose equivalent safe booking URLs rather than making `web/` infer them from raw payload fields.
- `server/src/formatAvailability.js` already centralizes `formatDateTime`; public display data should reuse or extend this formatting logic so web, share text, and future bots do not drift.
- `server/src/availabilityStore.js` already provides `getAvailabilityPayload(venueId)`; the public endpoint should read through this store rather than reaching into Supabase directly.

### Established Patterns

- Backend is dependency-free CommonJS. Any endpoint work should fit the existing small HTTP server pattern unless the plan explicitly introduces a framework.
- Share-token failures currently return `404` through `notFound(response)`; public endpoint should preserve this less-discoverable behavior for invalid tokens.
- Protected raw availability endpoints under `/api/availability/:venueId` require `x-sync-token`; the new public endpoint must not reuse those raw responses or require the sync token.
- Extension remains plain MV3 JavaScript. Phase 1 should not refactor extension code unless planning finds a narrow share-link configuration need.

### Integration Points

- New route family: `GET /api/public/:shareToken/:venueId`, plus matching `OPTIONS` handling if the `web/` app is served from a different origin.
- New display transformation module can sit in `server/src/` near `sharePage.js` and `formatAvailability.js`.
- New `web/` app will fetch the public display endpoint and map `themeId` to full ProPickle theme data locally.
- Existing `/s/:shareToken/:venueId` and `/s/:shareToken/:venueId/text` must continue working as the stable fallback.

</code_context>

<specifics>
## Specific Ideas

- The web UI should treat the endpoint as display data, not raw scraping data.
- The web UI owns the full visual theme so court/ball animation, GSAP/R3F details, and future venue-specific assets live close to the frontend.
- The public endpoint should give enough status detail for good UI states without helping token probing.

</specifics>

<deferred>
## Deferred Ideas

- Web app routing, extension share-link behavior, motion implementation depth, and deployment path were identified as gray areas but not discussed in this pass.

</deferred>

---

*Phase: 1-Venue-Themed Availability UI*
*Context gathered: 2026-07-02*
