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
4. If Chrome opens the booking page, complete login/waiver/security checks manually.
5. Once the actual schedule is visible, click **Read Current Page**.

The extension uses your normal Chrome session. It does not store or ask for credentials.

## Use: Current Page Flow

1. Open a compatible Playbypoint booking page in normal Chrome.
2. Log in manually if needed.
3. Accept any waiver/conditions manually only if you genuinely agree.
4. Navigate to the actual availability page.
5. Click the extension icon.
6. Click **Read Current Page**.

The popup shows each loaded day with merged open intervals, for example:

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

The **Copy JSON** and **Download JSON** buttons appear only after a result exists.

## Persistence

The latest successful read is stored in Chrome local extension storage per venue. If you close or unfocus the popup, reopening it shows the saved result for the selected venue without refreshing. Click **Refresh Venue** when you want fresh data.

This matters for future venues: ProPickle, Broadway Pickleball, and North Ryde should not overwrite each other.

## Compatibility

This extension targets Playbypoint pages that render a `BookBox` booking widget with visible day buttons and time-slot buttons.

Known starting point:

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
  popup.html
  popup.css
  popup.js
  venues.js
  providers/
    playbypointBookBox.js
```

No Python setup is required for the current extension-only version.
