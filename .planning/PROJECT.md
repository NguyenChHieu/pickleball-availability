# Pickleball Availability Buddy

## What This Is

Pickleball Availability Buddy is a read-only availability helper for Playbypoint-powered pickleball venues. Today it uses a Chrome extension to read ProPickle availability from the user's normal logged-in browser session, syncs the latest result to a full-stack Next.js app, and renders a secret-link availability page for easy sharing.

The product direction is to become a small multi-venue availability companion: ProPickle first, then Broadway Pickleball and North Ryde, with a more polished venue-themed viewing experience and a future bot layer that replies from the cached data.

## Core Value

Show trustworthy open booking intervals quickly without manually clicking every booking day.

## Requirements

### Validated

- Extension can read visible ProPickle Playbypoint BookBox day tabs and time slots from the user's normal Chrome session.
- Extension merges adjacent open time slots into useful intervals per day.
- Extension stores the latest successful payload per venue in Chrome local storage.
- Next API routes accept token-protected availability syncs and store one latest payload per venue.
- Next API routes can use Supabase for durable cache storage across Vercel deployments and serverless restarts.
- Secret share page renders cached availability and never triggers scraping itself.
- Per-day "Open booking" links can open the booking page with a date marker; the extension may select that day when the user is already logged in.
- Popup is a manual control panel: saved result, refresh, current-page read, view availability, and copy share link.

### Active

- [ ] Create a modern venue-themed availability page that gives each venue its own visual identity.
- [ ] Keep venue/provider logic modular so more Playbypoint venues can be added without rewriting the scraper.
- [x] Use one full-stack Next.js TypeScript app for share UI, API routes, cache access, and future bot webhooks.
- [ ] Add Broadway Pickleball and North Ryde after the themed ProPickle path is proven.
- [ ] Preserve a shared formatter/cache layer so future Messenger or Telegram bots reuse the same data model.

### Out of Scope

- Booking, checkout, payment, player selection, or reservation automation - this project stays read-only.
- Login, waiver, Cloudflare, CAPTCHA, or access-control bypassing - the user handles setup manually in normal Chrome.
- High-frequency polling - requests should stay low-frequency and user-directed unless a later feature explicitly designs a polite schedule.
- Public raw slot JSON exposure - public links should render summaries, not leak implementation payloads.
- Putting Supabase secret keys or backend sync secrets in the extension - secrets stay backend-only.

## Context

- The first target venue is ProPickle at `https://book.propickle.com.au/book/ProPickle?skip_waivers=true`.
- ProPickle booking appears to run on Playbypoint, not a custom ProPickle system.
- Some logged-out Playbypoint pages render date buttons but hide available times behind login; the reader treats those as setup-required instead of syncing false empty results.
- The current extension is intentionally plain Chrome MV3 JavaScript with no build step.
- The share/API app lives in `web/` using Next.js, TypeScript, and venue theme tokens, while keeping the extension boring and reliable.
- Supabase remains the deployment cache so the public share page and future bots can read the latest payload without running a scraper.

## Constraints

- **Safety**: Read-only only - prevents accidental bookings or account/security issues.
- **Authentication**: Uses the user's existing browser session - avoids credential handling and server-side login automation.
- **Architecture**: Extension reads, Next API stores, share page renders, future bots format cached data - keeps responsibilities separated inside one deployment.
- **Deployment**: Vercel Next app plus Supabase cache - simple HTTPS hosting and durable latest-payload storage.
- **UX**: Popup should not surprise-refresh on open - saved results persist until the user manually refreshes or reads.
- **Scalability**: Add venues through venue/provider configuration first - avoid framework migration before the current provider shape is proven with more than one venue.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use a Chrome extension for scraping | The user is already authenticated and past waiver/security checks in normal Chrome | Good |
| Keep extension plain JavaScript | No build step, easy unpacked install, less moving parts for MV3 | Good |
| Use backend cache instead of live public scraping | Share links and future bots should read from cached user-approved snapshots | Good |
| Use Supabase REST cache for deploy persistence | Avoids direct Postgres dependency and survives Vercel serverless restarts | Good |
| Keep booking actions read-only | Opening/selecting a day is useful without automating booking/payment | Good |
| Use Next.js TypeScript as the single deployed app | The extension should stay simple while the web app owns UI, APIs, cache, and webhook routes | Good |

---
*Last updated: 2026-06-30 after GSD initialization from current repo state*
