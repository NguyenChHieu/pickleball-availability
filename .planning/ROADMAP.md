# Roadmap: Pickleball Availability Buddy

## Completed Foundation

### Multi-Venue Availability

- Six venue configurations across Playbypoint, ClubSpark, Mindbody, Playtomic, PodPlay, and Hamlet.
- Separate provider adapters with normalized any-court and same-court availability.
- Venue-themed share pages, scalable venue navigation, freshness, and read-only booking links.

### Refresh And Shared Cache

- Manual selected, stale, all, current-page, and deep refresh paths.
- Unfocused reader-window orchestration for normal multi-venue refreshes.
- Per-venue timing/status history and preservation of last successful payloads.
- Token-protected Next sync API and durable Supabase latest-payload cache.
- Reusable text formatter and Messenger webhook delivery from cached data.

### Anonymous Group Planner V1

- Secret event creation with date range, preferred hours, selected venues, and minimum session length.
- 30-minute participant grid with continuous overlap heatmap.
- Optional recovery password plus same-device opaque edit token.
- Durable recovery throttling and allowlisted public planner responses.
- Cached venue recommendations with any-court and same-court confidence.

## Current Phase: Planner Release QA

**Goal:** Prove the anonymous planner in production-like storage and browser sessions before merging it to `main`.

**Release gate:**

1. Run fixtures, typecheck, lint, and production build.
2. Test create/save/reload in a normal browser session.
3. Test forget-device and private-session recovery with wrong and correct passwords.
4. Confirm repeated wrong recovery attempts return `429` without blocking a valid local edit token.
5. Confirm public responses expose no edit token or password hash.
6. Confirm ProPickle matches use normal open intervals and deep scan only improves same-court confidence.
7. Publish and review a Vercel preview before merging.

## Next Phase: Shared Cache Reliability

**Goal:** Make the latest cached result useful to multiple viewers without unnecessary scraping.

- Surface last successful read clearly when a new refresh fails.
- Keep short freshness guidance and avoid treating cached data as live.
- Add lightweight operational visibility for venue sync failures.
- Decide whether planner venue freshness needs a user-facing stale threshold control.

## Candidate Phase: Public-Venue Scheduled Refresh

**Goal:** Explore one polite scheduled refresh path only for guest-visible providers.

- Start with a venue whose data can be read publicly without login or browser challenges.
- Keep authenticated/session-bound venues extension-only.
- Define frequency, rate limits, failure backoff, and provider terms before implementation.
- Do not introduce general headless login automation.

## Later Product Layers

- Telegram or another supported bot channel backed by the existing formatter/cache.
- Optional accounts with saved venue and preferred-hour profiles.
- Group history or reusable planner templates once repeat usage justifies accounts.
- More venues through the existing provider boundary.

## Explicitly Deferred

- Booking, checkout, payment, login, waiver, or CAPTCHA automation.
- High-frequency polling.
- Mandatory accounts for anonymous planner V1.
- A second web deployment or a separate bot data model.

---
*Last updated: 2026-07-13 during planner release QA*
