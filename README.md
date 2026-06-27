# Pickleball Availability Helper

Small read-only Chrome extension for Playbypoint booking pages.

It reads the visible booking day tabs, merges adjacent open time slots, and keeps the last successful result in the extension popup so you can close/reopen it without losing the view.

## Guardrails

- Read-only availability inspection only.
- No booking, payment, checkout, login, waiver, or access-control automation.
- You log in and accept any required waiver manually in normal Chrome.
- The extension only clicks visible day tabs in the booking calendar strip.
- Results refresh only when you click **Read Page**.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select `C:\Users\nguye\Downloads\propickle-buddy\extension`.
5. Pin the extension if you want quick access.

After code changes, return to `chrome://extensions` and click the reload icon on the extension card.

## Use

1. Open a compatible Playbypoint booking page in normal Chrome.
2. Log in manually if needed.
3. Accept any waiver/conditions manually only if you genuinely agree.
4. Navigate to the actual availability page.
5. Click the extension icon.
6. Click **Read Page**.

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

The latest successful read is stored in Chrome local extension storage per booking page URL. If you close or unfocus the popup, reopening it shows the saved result for the current booking page. Click **Read Page** again to refresh.

This matters for future venues: ProPickle, Broadway Pickleball, and North Ryde should not overwrite each other as long as their booking pages have different URLs.

## Compatibility

This extension targets Playbypoint pages that render a `BookBox` booking widget with visible day buttons and time-slot buttons.

Known starting point:

```text
https://book.propickle.com.au/f/ProPickle/booking_waiver
```

Other Playbypoint venues may work if they use the same booking widget. Open the venue page manually, reach the availability screen, then run **Read Page**.

## Project Shape

```text
extension/
  manifest.json
  popup.html
  popup.css
  popup.js
  contentScript.js
```

No Python setup is required for the current extension-only version.
