# Pickleball Planner V1

## Purpose

The planner answers two separate questions:

1. When can the group play?
2. Which cached venue availability overlaps those times?

People overlap is useful even when venue cache is empty. Venue recommendations are an enhancement and never trigger scraping.

## Implemented Flow

- A host creates a secret event with a name, date range, preferred daily hours, selected venues, and minimum session length.
- Participants open `/p/:eventToken`, enter a display name, and mark 30-minute cells.
- The heatmap shows group overlap immediately; hover or tap reveals participant names.
- Venue matches intersect people overlap with cached availability and label same-court versus any-court confidence.
- The extension may refresh venue cache separately, but the planner itself stays read-only and cache-only.

## Participant Editing And Recovery

- A successful save stores an opaque edit token in local storage for convenient same-browser updates.
- A recovery password is optional. It is useful only when the participant wants to edit from another browser/device.
- Passwords are salted and hashed server-side with `scrypt`; public event responses never include hashes or edit tokens.
- Display names are normalized per event to avoid accidental duplicate identities.
- Failed recovery attempts use durable Supabase throttling and return `429` once blocked.
- “Forget this device” removes local edit access without deleting the participant's public availability.

## Matching Model

1. Normalize participant blocks to date and minute ranges.
2. Build contiguous bands where the same set of people is available.
3. Normalize each venue day into any-court intervals and same-court runs where court labels exist.
4. Intersect participant bands, preferred hours, minimum duration, and venue intervals.
5. Rank more people first, then same-court confidence, fresh cache, earlier slots, and stable venue ordering.
6. Treat same-court data as confidence metadata; normal any-court availability is sufficient for a venue match.

## Privacy And Safety

- Event tokens and participant edit tokens are unguessable random values.
- Booking-site credentials are never stored.
- Planner APIs do not expose password hashes, edit tokens, raw Supabase records, or raw venue slot payloads.
- Planner pages do not automate scraping, booking, checkout, login, payment, waivers, or CAPTCHA.
- Secret links are possession-based sharing, not a replacement for accounts or high-security access control.

## Storage

Supabase tables:

- `planner_events`
- `planner_event_venues`
- `planner_participants`
- `planner_availability_blocks`
- `planner_recovery_attempts`

Local file storage is retained for development only. Deployed planner storage requires `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.

## Release QA

- Create an event and save a new participant without a password.
- Reload and update using the same-browser token.
- Create another participant with a recovery password.
- Forget local access, then verify wrong-password rejection and correct-password recovery.
- Verify repeated failed recovery attempts return `429` and valid local edit tokens still work.
- Inspect public event JSON to confirm secret fields are absent.
- Verify the heatmap and ProPickle venue matches update from normal cached open intervals.

## Later

- Accounts may store preferred venues, preferred hours, and reusable planner defaults once repeat usage justifies them.
- Email recovery is intentionally absent from V1.
- Scheduled venue refresh remains a separate provider-specific decision.
