from __future__ import annotations

import argparse
import asyncio
import re
import sys
from typing import Any

from scraper_common import (
    DEFAULT_DAY_PATTERNS,
    DEFAULT_URL,
    cookie_header_to_playwright_cookies,
    is_dangerous_control_text,
    load_cookie_header,
    normalize_whitespace,
    redact_sensitive_text,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Open a public Playbypoint/ProPickle page, inspect Fetch/XHR responses, "
            "and optionally click weekday controls to reveal availability endpoints."
        )
    )
    parser.add_argument("--url", default=DEFAULT_URL, help="Starting page URL.")
    parser.add_argument(
        "--output",
        default="endpoints_log.json",
        help="Where to write captured Fetch/XHR metadata.",
    )
    parser.add_argument(
        "--headful",
        action="store_true",
        help="Show the browser window for debugging.",
    )
    parser.add_argument(
        "--storage-state",
        help=(
            "Optional Playwright storage_state JSON exported from your own browser session. "
            "Use only for pages you are allowed to access."
        ),
    )
    parser.add_argument(
        "--timeout-ms",
        type=int,
        default=30000,
        help="Navigation timeout in milliseconds.",
    )
    parser.add_argument(
        "--settle-ms",
        type=int,
        default=1500,
        help="Delay after page load/clicks so XHR responses can finish.",
    )
    parser.add_argument(
        "--sample-chars",
        type=int,
        default=1200,
        help="Maximum response body sample length to log for JSON/text responses.",
    )
    parser.add_argument(
        "--skip-clicks",
        action="store_true",
        help="Only inspect network traffic from the initial page load.",
    )
    parser.add_argument(
        "--click-selector",
        default="button, [role='button'], a",
        help="CSS selector for safe day/date controls. Customize if Playbypoint uses different markup.",
    )
    parser.add_argument(
        "--click-text",
        action="append",
        help=(
            "Regex text for controls to click. Repeatable. Defaults to weekday names/abbreviations. "
            "Examples: --click-text Monday --click-text 'Tue|Tuesday'"
        ),
    )
    parser.add_argument(
        "--max-clicks",
        type=int,
        default=14,
        help="Hard cap on read-only UI clicks during discovery.",
    )
    return parser.parse_args()


async def capture_response(response: Any, events: list[dict[str, Any]], sample_chars: int) -> None:
    request = response.request
    resource_type = request.resource_type
    if resource_type not in {"fetch", "xhr"}:
        return

    content_type = response.headers.get("content-type", "")
    event: dict[str, Any] = {
        "url": response.url,
        "method": request.method,
        "status": response.status,
        "resource_type": resource_type,
        "content_type": content_type,
        "sample": "",
    }

    lower_content_type = content_type.lower()
    if any(kind in lower_content_type for kind in ("json", "text", "html", "javascript")):
        try:
            body = await response.text()
            event["sample"] = redact_sensitive_text(body[:sample_chars])
        except Exception as exc:  # Playwright can fail to read some streaming/cached bodies.
            event["sample"] = f"<body unavailable: {exc}>"

    events.append(event)
    print(f"[{event['status']}] {event['method']} {event['url']}")
    print(f"    type={event['resource_type']} content-type={event['content_type'] or 'unknown'}")
    if event["sample"]:
        print("    sample:")
        for line in str(event["sample"]).splitlines()[:8]:
            print(f"      {line[:180]}")


def compile_patterns(values: list[str] | None) -> list[re.Pattern[str]]:
    raw_patterns = values or DEFAULT_DAY_PATTERNS
    compiled: list[re.Pattern[str]] = []

    for value in raw_patterns:
        try:
            compiled.append(re.compile(value, re.IGNORECASE))
        except re.error:
            compiled.append(re.compile(re.escape(value), re.IGNORECASE))

    return compiled


async def click_matching_controls(page: Any, args: argparse.Namespace) -> None:
    patterns = compile_patterns(args.click_text)
    clicked_texts: set[str] = set()
    total_clicks = 0

    for pattern in patterns:
        if total_clicks >= args.max_clicks:
            return

        locator = page.locator(args.click_selector).filter(has_text=pattern)
        try:
            count = await locator.count()
        except Exception as exc:
            print(f"Could not inspect controls for {pattern.pattern!r}: {exc}", file=sys.stderr)
            continue

        for index in range(count):
            if total_clicks >= args.max_clicks:
                return

            candidate = locator.nth(index)
            try:
                if not await candidate.is_visible():
                    continue

                text = normalize_whitespace(await candidate.inner_text(timeout=1000))
                if not text or text.lower() in clicked_texts:
                    continue
                if is_dangerous_control_text(text):
                    print(f"Skipping payment/booking-looking control: {text[:80]!r}")
                    continue

                print(f"Clicking read-only discovery control: {text[:100]!r}")
                await candidate.click(timeout=5000, no_wait_after=True)
                await page.wait_for_timeout(args.settle_ms)
                clicked_texts.add(text.lower())
                total_clicks += 1
                break
            except Exception as exc:
                print(f"Skipping control match {pattern.pattern!r} at index {index}: {exc}", file=sys.stderr)


async def run() -> int:
    args = parse_args()

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print(
            "Playwright is not installed. Run: pip install -r requirements.txt "
            "then python -m playwright install chromium",
            file=sys.stderr,
        )
        return 2

    events: list[dict[str, Any]] = []
    response_tasks: set[asyncio.Task[None]] = set()

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=not args.headful)
        context_kwargs: dict[str, Any] = {
            "user_agent": "ProPickleAvailabilityHelper/0.1 read-only endpoint discovery",
        }
        if args.storage_state:
            context_kwargs["storage_state"] = args.storage_state

        context = await browser.new_context(**context_kwargs)

        cookie_header = load_cookie_header()
        if cookie_header:
            await context.add_cookies(cookie_header_to_playwright_cookies(cookie_header, args.url))

        page = await context.new_page()
        page.set_default_timeout(args.timeout_ms)

        def schedule_capture(response: Any) -> None:
            task = asyncio.create_task(capture_response(response, events, args.sample_chars))
            response_tasks.add(task)
            task.add_done_callback(response_tasks.discard)

        page.on("response", schedule_capture)

        print(f"Opening {args.url}")
        await page.goto(args.url, wait_until="domcontentloaded", timeout=args.timeout_ms)
        await page.wait_for_timeout(args.settle_ms)

        if not args.skip_clicks:
            await click_matching_controls(page, args)

        if response_tasks:
            await asyncio.gather(*response_tasks, return_exceptions=True)

        write_json(args.output, events)
        print(f"Wrote {len(events)} Fetch/XHR event(s) to {args.output}")
        await browser.close()

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(run()))
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        raise SystemExit(130)
