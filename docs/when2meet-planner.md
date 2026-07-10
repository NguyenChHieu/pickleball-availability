# Pickleball Planner Concept

## Goal

Build a when2meet-style planner that combines people availability with cached venue availability.
The app should answer: "When can this group play, and which venues have courts then?"

## Recommended V1

Use secret event links, not accounts.

- A host creates a planner event with preferred venues, date range, and preferred hours.
- Friends open a secret link and mark available time blocks.
- The app intersects group availability with cached venue availability.
- Results show ranked options like:
  - everyone can play, same-court venue availability exists;
  - most people can play, venue availability exists;
  - people can play but venue cache is stale.

This keeps v1 close to the current product model: public-ish secret links, cached venue data, no login requirement, and no booking automation.

## Later Account Model

Accounts become useful once the planner has repeat users.

- User profile:
  - display name;
  - preferred venues;
  - preferred days/hours;
  - default minimum session length;
  - optional timezone.
- Group/event profile:
  - venue shortlist;
  - date range;
  - required players threshold;
  - privacy setting;
  - cached recommendation snapshot.

Keep accounts separate from venue scraping. Accounts should store preferences only; they should not store booking-site credentials.

## Matching Algorithm

1. Normalize every person availability block to date plus minute ranges.
2. Normalize venue availability to:
   - any-court intervals;
   - same-court intervals where available;
   - freshness/stale status.
3. For each venue and day, intersect:
   - group availability;
   - preferred hours;
   - venue any-court intervals.
4. Score each candidate:
   - higher score for more available people;
   - higher score for same-court continuity;
   - lower score for stale venue cache;
   - lower score for setup-required venues;
   - lower score when exact court labels are not exposed.
5. Render ranked recommendations, not automatic bookings.

## Privacy And Safety

- Do not store booking-site credentials.
- Do not automate booking, checkout, login, payment, waivers, or CAPTCHA.
- Make secret planner links unguessable.
- Show cache freshness beside every venue recommendation.
- Let users delete their own availability from a planner event.

## Data Model Sketch

Possible Supabase tables later:

- `planner_events`
  - `id`, `share_token`, `name`, `created_at`, `date_start`, `date_end`, `preferred_start_time`, `preferred_end_time`
- `planner_event_venues`
  - `event_id`, `venue_id`
- `planner_participants`
  - `id`, `event_id`, `display_name`, `created_at`
- `planner_availability_blocks`
  - `participant_id`, `date`, `start_time`, `end_time`
- `user_profiles` later only if accounts are added
  - `id`, `display_name`, `preferred_venue_ids`, `preferred_hours`

## Open Decisions

- Whether anonymous secret links are enough for v1.
- Whether participant edits need email/passcode protection.
- Whether time input should be grid-based like when2meet or a compact mobile time-block picker.
- Whether planner results should use only cached venue data or offer a "refresh selected venues" prompt through the extension.

## UX Follow-Ups

- Show group overlap even when venue cache is empty, e.g. "2 people overlap Mon 7:30-8:30" plus "no venue cache yet."
- Add a When2Meet-style overlap heat/gradient layer so users can inspect which time blocks have the strongest people overlap before venue matching.
