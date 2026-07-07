# Pickleball Availability Helper

Small read-only Chrome extension plus a full-stack Next.js availability share app for pickleball booking pages.

It can refresh configured venues such as ProPickle, Broadway Pickleball, and North Ryde; read compatible current pages; merge adjacent open time slots; and keep the last successful result in the extension popup and share app.

## Guardrails

- Read-only availability inspection only.
- No booking, payment, checkout, login, waiver, or access-control automation.
- You log in and accept any required waiver manually in normal Chrome.
- The extension only clicks visible day tabs in the booking calendar strip.
- Venue refreshes are user-directed; opening the popup shows saved data without surprise refreshes.
- No scheduled background polling.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select `C:\Users\nguye\Downloads\propickle-buddy\extension`.
5. Pin the extension if you want quick access.

After code changes, return to `chrome://extensions` and click the reload icon on the extension card.

## Use: Venue Flow

1. Click the extension icon.
2. Pick a **Refresh target**.
3. Click **Refresh Stale** for the normal low-noise refresh, or **Refresh Selected** when you want a fresh read for one venue.
4. If you are already logged in, ProPickle refresh can usually open the booking page in the background, read it, sync it, and close the tab.
5. If Chrome opens the booking page for login, waiver, or security checks, complete that setup manually.
6. The extension keeps watching that tab and continues automatically when the schedule appears.
7. Use **More actions** for lower-frequency tools such as **Refresh all**, **Read current tab**, or **Deep scan courts**.

The extension uses your normal Chrome session. It does not store or ask for credentials.

If login redirects to a profile/account page, an active venue refresh can return that same tab to the booking URL once and continue from there. Auth/setup checks should happen quickly; the longer readiness wait is reserved for pages that look like they may still be loading the authenticated booking widget.

## Use: Current Page Flow

1. Open a compatible Playbypoint booking page in normal Chrome.
2. Log in manually if needed.
3. Accept any waiver/conditions manually only if you genuinely agree.
4. Navigate to the actual availability page.
5. Click the extension icon.
6. Open **More actions** and click **Read current tab**.

The share page shows each loaded day with merged open intervals, for example:

```json
{
  "date": "Monday, Jun 29",
  "open_intervals": [
    { "start_time": "7am", "end_time": "6pm" },
    { "start_time": "9pm", "end_time": "11pm" }
  ],
  "remaining_hours": 13
}
```

The **View Availability** and **Copy Share Link** buttons appear only after a result has synced to the backend. Raw JSON export is intentionally hidden from the popup.

Each day on the share page includes **Open booking**, which opens the venue booking page with a date marker that the extension can use to select that day. If that does not happen, pick the day manually.

## Persistence

The latest successful read is stored in Chrome local extension storage per venue. If you close or unfocus the popup, reopening it shows the saved result for the selected venue without refreshing. Click **Refresh Stale** or **Refresh Selected** when you want fresh data.

Recent completed refresh jobs are also kept in a small popup history so you can see which runs completed, reused cache, failed, needed setup, and how long they took.

This matters for future venues: ProPickle, Broadway Pickleball, and North Ryde should not overwrite each other.

## Share Link And Web App

The extension can optionally sync successful reads to the Next.js app under `web/`. That one app stores the latest availability, exposes API routes, renders the public share page, and keeps the future Messenger webhook path in the same deployment.

The intended product flow is:

1. Extension reads availability from your logged-in browser.
2. Extension posts the latest payload to the Next app API.
3. You share a secret URL from the same app, such as `https://your-vercel-app.vercel.app/s/dev-share/propickle`.
4. Messenger or another bot can later reply from the same cached payload.

In extension options:

```text
Backend URL: http://localhost:3007
Sync token: dev-secret
Share URL base: http://localhost:3007
Share token: dev-share
```

After a successful read, click **Copy Share Link** in the popup.

Run the share UI locally with:

```bash
cd web
AVAILABILITY_SYNC_TOKEN=dev-secret SHARE_TOKEN=dev-share npm run dev -- --port 3007
```

On Vercel, import the repo with `web` as the root directory. Set the same `AVAILABILITY_SYNC_TOKEN` and `SHARE_TOKEN`, then set the extension Backend URL and Share URL base to the Vercel app URL.

For deployed cache persistence, use Supabase by setting `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Vercel. The schema is in `web/supabase.sql`.

## Compatibility

This extension targets venue-specific public/readable booking widgets through small providers:

- Playbypoint `BookBox` pages for ProPickle.
- ClubSpark `BookByDate` pages for Broadway Pickleball.
- Mindbody appointment pages for North Ryde.

Some logged-out Playbypoint pages still render date buttons but hide times behind a login prompt. The reader treats those pages as setup-required so it does not sync a false empty result.

Known starting point:

```text
https://book.propickle.com.au/book/ProPickle?skip_waivers=true
```

If the direct booking URL still asks for setup, use the venue's setup URL:

```text
https://book.propickle.com.au/f/ProPickle/booking_waiver
```

Other venues may work if they use one of the existing provider shapes. Add a venue config first, then reuse or add the smallest provider needed.

## Architecture

The project uses a small adapter/registry shape:

- `venues.js`: configured venues and storage keys.
- `providers/playbypointBookBox.js`: Playbypoint `BookBox` reader.
- `providers/clubsparkBookByDate.js`: ClubSpark day grid reader.
- `providers/mindbodyAppointments.js`: Mindbody appointment reader.
- `contentScript.js`: message bridge injected into readable pages.
- `background.js`: venue refresh orchestration and persistence.
- `popup.js`: venue selector, rendering, exports, and current-page actions.
- `web/app/api/availability/[venueId]`: token-protected sync/cache API for the extension.
- `web/app/s/[shareToken]/[venueId]`: secret-link availability page.
- `web/src/server/`: shared cache, formatter, public availability, and webhook helpers.

## Project Shape

```text
extension/
  background.js
  contentScript.js
  manifest.json
  options.html
  options.css
  options.js
  popup.html
  popup.css
  popup.js
  venues.js
  providers/
    playbypointBookBox.js
    clubsparkBookByDate.js
    mindbodyAppointments.js
web/
  supabase.sql
  app/
    api/
    s/
    webhook/
  src/
    components/
    lib/
    server/
```

No Python setup is required. The extension is plain Chrome JS, and the share/API app is Next.js.
