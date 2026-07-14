# Pickleball Availability Buddy

## What This Is

Pickleball Availability Buddy is a read-only availability companion for Sydney pickleball venues. A Chrome extension reads guest-visible or user-authenticated booking pages in the user's normal browser session, syncs the latest successful result to a Next.js app, and publishes venue-themed secret availability links. The web app also includes an anonymous When2Meet-style planner that combines group availability with cached venue results.

## Core Value

Show trustworthy court availability quickly, then help a group find a time and venue that work without automating booking.

## Validated Product

- Six configured venues: ProPickle, Broadway Pickleball, North Ryde, Sydney Racquet Club, House of Pickle Darling Harbour, and WOTSO Pyrmont.
- Provider-specific extension readers normalize venue schedules into one cached payload shape.
- Selected/stale venue refreshes run in a separate unfocused reader window; deep scans remain explicit.
- Saved extension results persist until a user-triggered refresh and survive individual refresh failures.
- One Next.js App Router deployment owns share pages, API routes, cache access, planner pages, and webhook routes.
- Supabase stores durable venue cache and planner data for Vercel.
- Secret availability pages show freshness, any-court and same-court confidence, venue-specific styling, and read-only booking links.
- Anonymous planner events provide a 30-minute overlap heatmap, optional participant recovery passwords, and cached venue recommendations.
- Messenger text formatting reuses the same cache payload and formatter rather than introducing a bot-specific model.

## Current Release Gate

- [ ] Complete planner production QA across normal and private browser sessions.
- [ ] Verify create, save, reload, forget-device, wrong-password throttling, correct recovery, heatmap, and ProPickle matching on a Vercel preview.
- [ ] Review the feature branch before merging to `main`.

## Next Product Layers

1. Improve shared-cache freshness and clearly preserve the last successful venue read.
2. Consider scheduled low-frequency refresh only for public guest-visible venues.
3. Add a chat delivery layer after cache reliability is proven; Telegram is simpler than relying on Messenger group chats.
4. Consider accounts only when recurring planner users need saved venue and preferred-hour profiles.

## Out Of Scope

- Booking, checkout, payment, player selection, or reservation automation.
- Login, waiver, Cloudflare, CAPTCHA, or access-control bypassing.
- Storing booking-site credentials.
- High-frequency polling or hidden server-side browser automation for authenticated venues.
- Public raw slot JSON or planner edit credentials.

## Architecture Boundary

- **Extension reads:** venue pages in a normal Chrome session and performs user-directed refreshes.
- **Next stores and presents:** APIs, availability pages, planner, text summaries, and webhook delivery.
- **Supabase persists:** latest venue payloads and anonymous planner records.
- **Planner consumes cache only:** planner pages never trigger scraping.
- **Booking remains manual:** links may open the relevant venue/date but never choose a time or submit a reservation.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Chrome extension for scraping | Reuses the user's normal guest/authenticated browser state without credential handling | Good |
| Plain JavaScript MV3 extension | Easy unpacked install and no extension build pipeline | Good |
| Provider interface per booking platform | Keeps DOM/API quirks isolated while preserving one payload shape | Good |
| Next.js TypeScript as one web deployment | Co-locates pages, APIs, planner, cache access, and bot delivery | Good |
| Supabase REST instead of direct Postgres | Fits Vercel serverless deployment and keeps persistence durable | Good |
| Secret-link availability and planner pages | Useful sharing without requiring accounts in V1 | Good |
| Optional participant recovery password | Same-device edits stay simple while another browser can recover safely | Good |
| Cached-only planner recommendations | Keeps planning fast and prevents planner pages from initiating scraping | Good |

---
*Last updated: 2026-07-13 during planner release QA*
