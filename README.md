# Pickleball Availability Helper

Small read-only Chrome extension for Playbypoint booking pages.

It can read the current booking page or refresh a configured venue such as ProPickle. It reads visible booking day tabs, merges adjacent open time slots, and keeps the last successful result in the extension popup.

## Guardrails

- Read-only availability inspection only.
- No booking, payment, checkout, login, waiver, or access-control automation.
- You log in and accept any required waiver manually in normal Chrome.
- The extension only clicks visible day tabs in the booking calendar strip.
- Venue results auto-refresh only when no saved result exists yet.
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
2. Pick **ProPickle**.
3. The extension refreshes the venue automatically only if there is no saved result yet.
4. If you are already logged in, ProPickle refresh can usually open the booking page in the background, read it, sync it, and close the tab.
5. If Chrome opens the booking page for login, waiver, or security checks, complete that setup manually.
6. The extension keeps watching that tab and continues automatically when the schedule appears.

The extension uses your normal Chrome session. It does not store or ask for credentials.

If login redirects to a profile/account page, an active venue refresh can return that same tab to the booking URL once and continue from there. Auth/setup checks should happen quickly; the longer readiness wait is reserved for pages that look like they may still be loading the authenticated booking widget.

## Use: Current Page Flow

1. Open a compatible Playbypoint booking page in normal Chrome.
2. Log in manually if needed.
3. Accept any waiver/conditions manually only if you genuinely agree.
4. Navigate to the actual availability page.
5. Click the extension icon.
6. Click **Read Current Page**.

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

Each day on the share page includes booking links. **Book this day** opens the venue booking page with a date marker that the extension can use to select that day; **Open booking page** is a plain fallback link.

## Persistence

The latest successful read is stored in Chrome local extension storage per venue. If you close or unfocus the popup, reopening it shows the saved result for the selected venue without refreshing. Click **Refresh Venue** when you want fresh data.

This matters for future venues: ProPickle, Broadway Pickleball, and North Ryde should not overwrite each other.

## Share Link And Backend

The extension can optionally sync successful reads to a small local/backend service. That backend stores the latest availability, renders a phone-friendly share page, and exposes Messenger webhook endpoints.

Start here:

```text
server/README.md
```

The intended product flow is:

1. Extension reads availability from your logged-in browser.
2. Extension posts the latest payload to the backend.
3. You share a secret URL such as `https://your-render-url/s/dev-share/propickle`.
4. Messenger or another bot can later reply from the same cached payload.

In extension options:

```text
Backend URL: http://localhost:8787
Sync token: dev-secret
Share URL base: http://localhost:8787
Share token: dev-share
```

After a successful read, click **Copy Share Link** in the popup.

For durable Render deploys, use Supabase by setting `SUPABASE_URL` and `SUPABASE_SECRET_KEY` on the backend. A Render persistent disk also works by setting `AVAILABILITY_DATA_DIR`, but Supabase is the better path once more venues or bots are added.

## Compatibility

This extension targets Playbypoint pages that render a `BookBox` booking widget with visible day buttons and time-slot buttons.

Some logged-out Playbypoint pages still render date buttons but hide times behind a login prompt. The reader treats those pages as setup-required so it does not sync a false empty result.

Known starting point:

```text
https://book.propickle.com.au/book/ProPickle?skip_waivers=true
```

If the direct booking URL still asks for setup, use the venue's setup URL:

```text
https://book.propickle.com.au/f/ProPickle/booking_waiver
```

Other Playbypoint venues may work if they use the same booking widget. Add a venue config first, then reuse the Playbypoint provider.

## Architecture

The extension uses a small adapter/registry shape:

- `venues.js`: configured venues and storage keys.
- `providers/playbypointBookBox.js`: Playbypoint `BookBox` reader.
- `contentScript.js`: message bridge injected into readable pages.
- `background.js`: venue refresh orchestration and persistence.
- `popup.js`: venue selector, rendering, exports, and current-page actions.

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
server/
  supabase.sql
  src/
    index.js
    availabilityStore.js
    formatAvailability.js
    messenger.js
    sharePage.js
```

No Python setup is required. The extension is plain Chrome JS, and the optional bot backend runs on Node.
