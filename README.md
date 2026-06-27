# ProPickle Availability Helper

Small read-only scraper/helper for public ProPickle booking availability pages that appear to be powered by Playbypoint.

## Guardrails

- Read-only inspection only.
- Do not automate booking, payment, checkout, login bypasses, or access-control bypasses.
- Keep requests low-frequency.
- Prefer static public HTML first.
- Use Playwright only for dynamic pages where availability is loaded after clicking date/day controls.

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m playwright install chromium
```

For Git Bash:

```bash
python -m venv .venv
source .venv/Scripts/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m playwright install chromium
```

## Preferred Flow

Use the browser exporter from normal Chrome. This avoids automated login and avoids trying to bypass Cloudflare/security verification.

```bash
cd /c/Users/nguye/Downloads/propickle-buddy
clip < browser_export.js
```

Then paste it into DevTools Console on the actual booking page. It will download/copy `browser_availability.json`.

```bash
python parse_browser_export.py --input browser_availability.json
cat remaining_hours.json
```

## Bookmarklet

Build the bookmarklet installer:

```bash
python build_bookmarklet.py
```

Then open `install_bookmarklet.html` in Chrome and drag **Read Pickleball Availability** to the bookmarks bar. On any compatible Playbypoint booking page, log in normally, click the bookmarklet, and parse the downloaded JSON:

```bash
python parse_browser_export.py --input browser_availability.json
cat remaining_hours.json
```

This should also be the starting point for Broadway Pickleball or North Ryde if their booking pages use the same Playbypoint `BookBox` UI.

## Chrome Extension

For everyday use, load the unpacked extension:

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select `C:\Users\nguye\Downloads\propickle-buddy\extension`.
5. Open a compatible Playbypoint booking page in normal Chrome.
6. Click the extension icon, then **Read Page**.

The extension shows open intervals directly in the popup. Use **Copy JSON** or **Download JSON** if you still want to save the raw export and run:

```bash
python parse_browser_export.py --input browser_availability.json
```

The popup keeps the last successful read in Chrome local storage. Closing or unfocusing the popup will not clear the result; click **Read Page** again when you want to refresh from the current booking page.

The useful answer is `open_intervals` for each day, for example:

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

## 1. Save a Local Login Session

Do not paste credentials into scripts or chats. Instead, open a real browser, log in normally, and manually accept any waiver/conditions only if you genuinely agree.

```powershell
python save_session.py
```

When the actual availability page is visible, return to the terminal and press Enter. This writes `auth_state.json`, which is gitignored.

Use that local session with the Playwright scripts:

```powershell
python discover_endpoints.py --storage-state auth_state.json --headful
python scrape_dynamic.py --storage-state auth_state.json --headful
```

Do not use this helper to automate payment, checkout, or an actual booking.

### If Cloudflare/security verification gets stuck

Do not try to bypass bot protection. Open the page in normal Chrome instead, log in manually, accept any waiver/conditions manually if you genuinely agree.

Best option: use the read-only browser exporter from DevTools Console:

1. Open the actual booking page in normal Chrome.
2. Open DevTools Console.
3. Paste the contents of `browser_export.js`.
4. Press Enter.

The snippet clicks only the visible day buttons in the booking calendar strip, reads visible time buttons, merges adjacent open slots, copies JSON to your clipboard, and downloads `browser_availability.json`.

Then convert the export:

```powershell
python parse_browser_export.py --input browser_availability.json
```

Outputs:

- `remaining_hours.json`: one entry per loaded day, with `open_intervals`.
- `availability_intervals.json`: flat merged interval rows.
- `availability.json`: raw time-slot rows.

Manual fallback: save the visible availability page:

1. Press `Ctrl+S`.
2. Save as `availability.html` inside this project folder.
3. Parse the saved file:

```powershell
python scrape_saved_html.py --input availability.html
```

This fallback makes no network requests.

For the "remaining hours" view, save one HTML file per day after clicking that day in the booking calendar:

```text
day-fri.html
day-sat.html
day-sun.html
day-mon.html
```

Then parse all of them at once:

```powershell
python scrape_saved_html.py --input day-fri.html day-sat.html day-sun.html day-mon.html --source-url "https://book.propickle.com.au/book/ProPickle?skip_waivers=true"
```

Outputs:

- `availability.json`: raw hourly slot rows.
- `availability_intervals.json`: merged open slot intervals.
- `remaining_hours.json`: one summary per visible booking-strip day. Days present in the strip but not loaded in the saved HTML are marked `not_loaded`.

## 2. Discover hidden XHR/fetch endpoints

Start here. This opens the target page, listens for Fetch/XHR traffic, and clicks safe weekday-looking controls only.

```powershell
python discover_endpoints.py --storage-state auth_state.json --headful
```

Useful options:

```powershell
python discover_endpoints.py --skip-clicks
python discover_endpoints.py --click-text Monday --click-text Tuesday
python discover_endpoints.py --click-selector "button, [role='button'], a"
```

Output:

- `endpoints_log.json`: URL, method, status, content type, and a redacted sample body for JSON/text responses.

Optional cookie support for pages you can already access normally:

```powershell
$env:PROPPICKLE_COOKIE_HEADER = "name=value; other=value"
python discover_endpoints.py --headful
```

## 3. Scrape public static HTML

```powershell
python scrape_static.py
```

To follow likely booking/program links discovered on the starting page:

```powershell
python scrape_static.py --follow-links --max-pages 5 --delay-seconds 1.5
```

Outputs:

- `availability.json`
- `availability.csv`
- `discovered_links.json`

## 4. Fallback dynamic DOM scraping

If no clean JSON endpoint is usable, scrape visible availability after day clicks:

```powershell
python scrape_dynamic.py --headful
```

After inspecting the page markup, customize selectors:

```powershell
python scrape_dynamic.py --candidate-selector "article, tr, .session-card, .booking-card"
```

## Data Shape

Each availability item is normalized to:

```json
{
  "source_url": "...",
  "title": "...",
  "date": "...",
  "start_time": "...",
  "end_time": "...",
  "status": "open/full/unknown",
  "price": "...",
  "link": "..."
}
```

## Notes

- The default selectors are intentionally conservative and may need tuning after `discover_endpoints.py` shows how Playbypoint loads the page.
- If a clean endpoint is found, add a dedicated endpoint fetcher rather than reusing browser automation.
- Keep any session cookies local and out of commits or screenshots.

## User-Friendly Directions

The current best prototype is the DevTools browser exporter because it runs inside your already logged-in normal browser session and only reads/clicks day tabs.

Good next options:

- Browser bookmarklet: one-click version of `browser_export.js`, easiest upgrade from DevTools.
- Chrome extension: popup button that runs the same content script on `book.propickle.com.au`, then renders interval cards in the extension popup.
- Local mini web app: paste/import `browser_availability.json` and view intervals in a nicer UI.

The browser extension is probably the cleanest final form: no IDE, no terminal for everyday use, and no stored credentials.
