# Project Learnings

This project started as a read-only ProPickle availability helper and became a small shareable availability system.

## Core Idea

- ProPickle booking runs through Playbypoint, not a custom ProPickle API.
- No public customer API was obvious for normal users.
- The safest path is to read what the logged-in browser can already see, cache that result, and show it somewhere easier to access.
- The tool stays read-only: no booking, no payment, no login bypass, no rate-limit bypass.

## Final Shape

- Chrome extension reads Playbypoint booking availability from the user browser session.
- Extension merges open slot intervals per day.
- Extension syncs the latest payload to a backend.
- Backend stores one latest payload per venue.
- Backend renders a secret-token share page:
  - `/s/:shareToken/:venueId`
  - `/s/:shareToken/:venueId/text`
- Share page is the viewing UI.
- Extension popup is now just a control panel: read, refresh, sync status, copy share link.

## Stack Decisions

- Chrome extension: best fit because the user is already logged in and has passed waiver/security checks in normal Chrome.
- Plain JavaScript extension: no build step, easy to load unpacked.
- Node backend: tiny HTTP server, no framework needed yet.
- Render: simple public HTTPS hosting for the backend.
- Supabase: durable cache so Render restarts/redeploys do not lose availability.
- No Python in final runtime: early scraping ideas used Python, but the extension/backend path became simpler.

## Important Tradeoffs

- Browser extension instead of backend scraper:
  - Uses the user's normal authenticated session.
  - Avoids automating login/Cloudflare/waiver handling on the server.
  - Requires Chrome to read/sync availability at least once.

- Supabase REST API instead of direct Postgres:
  - No `pg` dependency.
  - No database password/connection-string handling.
  - Good enough for "upsert one JSON payload per venue."
  - Direct Postgres only becomes useful later for richer queries or relational data.

- Secret share link instead of full auth:
  - Easier for friends to open.
  - Good enough for low-sensitivity availability snapshots.
  - Must not expose raw cache APIs publicly.

## Security Lessons

- Keep all secrets in Render/backend only:
  - `AVAILABILITY_SYNC_TOKEN`
  - `SHARE_TOKEN`
  - `SUPABASE_SECRET_KEY`
- Never put Supabase secret keys in the extension.
- Public share routes require the share token.
- Raw cache API reads require the sync token.
- Messenger webhook should not be enabled with real sending until Meta signature verification is added.

## Supabase Setup

Run this SQL:

```sql
create table if not exists public.availability_cache (
  venue_id text primary key,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.availability_cache enable row level security;
```

Render env vars:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
AVAILABILITY_SYNC_TOKEN=...
SHARE_TOKEN=...
```

The backend uses Supabase only when both `SUPABASE_URL` and `SUPABASE_SECRET_KEY` exist.

## How To Repeat For Another Venue

1. Find the venue's Playbypoint booking or waiver URL.
2. Add a venue entry in `extension/venues.js`.
3. Reuse `providers/playbypointBookBox.js` if the page uses the same BookBox widget.
4. Reload the unpacked extension.
5. Log in and accept any real waiver/security steps manually.
6. Click **Read Current Page**.
7. Confirm the popup says `Synced to backend.`
8. Open `/s/:shareToken/:venueId`.

## Useful Mental Model

- Extension reads.
- Backend stores.
- Share page renders.
- Future bots only ask the backend for formatted cached data.

This keeps venue scraping, storage, presentation, and bot delivery separated.

## Next Sensible Steps

- Add Broadway or North Ryde as the second venue.
- Add a clearer venue config pattern once there are two or three venues.
- Add optional low-frequency Chrome refresh later, while still using the user's normal session.
- Add Messenger/Telegram only after the cache and multi-venue path feel stable.
