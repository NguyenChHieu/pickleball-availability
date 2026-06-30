---
title: Venue-themed web app direction
date: 2026-06-30
context: gsd-explore session for Phase 1 UX direction
---

# Venue-Themed Web App Direction

## Decision

Build the polished availability experience as a separate `web/` Next.js TypeScript app that runs alongside the existing backend share page first.

The current backend share page at `/s/:shareToken/:venueId` should remain as the stable fallback while the new UI is proven.

## Target Experience

The ProPickle page should feel like a memorable product page, not just a utility table.

- First impression: branded, modern, and energetic.
- Visual direction: ProPickle-style black and white base, electric blue accents, and pickleball green highlights.
- Hero: scroll-reactive court/ball scene that gives the page a distinctive identity.
- Availability: readable mobile-first day cards with interval chips and clear "Open booking" actions.
- Motion: GSAP/React motion should support the information hierarchy, not distract from it.
- 3D/canvas: React Three Fiber or Three.js is acceptable for the hero if it stays lightweight and readable.

## Architecture Direction

Keep responsibilities separated:

- `extension/`: reads Playbypoint pages using the user's normal Chrome session.
- `server/`: stores cached availability, protects sync routes, formats bot/share data.
- `web/`: renders the polished venue-themed availability UI.

The new web app should not scrape or talk directly to Supabase in v1. It should read cached display data from the backend.

## Data Direction

Add a safe public display JSON endpoint, likely:

```text
GET /api/public/:shareToken/:venueId
```

This endpoint should:

- validate the same share token model as the HTML share page;
- return only display-safe availability data;
- avoid exposing raw slot JSON or backend internals;
- reuse existing formatter/cache logic where practical;
- support future venue themes and bot summaries without creating a separate data model.

## Why Alongside First

Running the new web UI alongside the current share page reduces risk:

- current share links keep working;
- backend deployment stays stable;
- the UI can be built and tested independently;
- routing can move later once the new page is clearly better.

## Next Planning Step

Use `$gsd-ui-phase 1` to define the design contract for the ProPickle themed page before implementing the Next.js app.
