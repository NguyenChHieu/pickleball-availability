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

## 1. Discover hidden XHR/fetch endpoints

Start here. This opens the target page, listens for Fetch/XHR traffic, and clicks safe weekday-looking controls only.

```powershell
python discover_endpoints.py --headful
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

## 2. Scrape public static HTML

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

## 3. Fallback dynamic DOM scraping

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
