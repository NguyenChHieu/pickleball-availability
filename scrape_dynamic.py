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
    dedupe_items,
    is_dangerous_control_text,
    item_from_text,
    load_cookie_header,
    looks_like_schedule_text,
    normalize_whitespace,
    write_csv,
    write_json,
)


DOM_CANDIDATE_SELECTOR = (
    "tr, article, li, [class*='card'], [class*='event'], [class*='program'], "
    "[class*='schedule'], [class*='session'], [class*='booking'], [data-testid]"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Fallback DOM scraper for public availability visible after clicking weekday controls."
        )
    )
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--output-json", default="availability.json")
    parser.add_argument("--output-csv", default="availability.csv")
    parser.add_argument("--headful", action="store_true")
    parser.add_argument("--storage-state")
    parser.add_argument("--timeout-ms", type=int, default=30000)
    parser.add_argument("--settle-ms", type=int, default=1500)
    parser.add_argument(
        "--click-selector",
        default="button, [role='button'], a",
        help="CSS selector for safe weekday/date controls.",
    )
    parser.add_argument(
        "--click-text",
        action="append",
        help="Regex text for controls to click. Defaults to weekdays.",
    )
    parser.add_argument("--max-clicks", type=int, default=14)
    parser.add_argument(
        "--candidate-selector",
        default=DOM_CANDIDATE_SELECTOR,
        help="CSS selector for schedule card/table candidates. Customize after inspecting the DOM.",
    )
    return parser.parse_args()


def compile_patterns(values: list[str] | None) -> list[re.Pattern[str]]:
    raw_patterns = values or DEFAULT_DAY_PATTERNS
    compiled: list[re.Pattern[str]] = []
    for value in raw_patterns:
        try:
            compiled.append(re.compile(value, re.IGNORECASE))
        except re.error:
            compiled.append(re.compile(re.escape(value), re.IGNORECASE))
    return compiled


async def extract_visible_items(page: Any, source_url: str, candidate_selector: str) -> list[dict[str, str]]:
    candidates = await page.evaluate(
        """
        (selector) => Array.from(document.querySelectorAll(selector)).map((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          const hidden = style.visibility === 'hidden' || style.display === 'none';
          const link = el.closest('a[href]') || el.querySelector('a[href]');
          const heading = el.querySelector('h1,h2,h3,h4,h5,h6');
          return {
            visible: !hidden && rect.width > 0 && rect.height > 0,
            text: el.innerText || el.textContent || '',
            title: heading ? (heading.innerText || heading.textContent || '') : '',
            link: link ? link.href : ''
          };
        })
        """,
        candidate_selector,
    )

    items: list[dict[str, str]] = []
    for candidate in candidates:
        if not candidate.get("visible"):
            continue
        text = normalize_whitespace(candidate.get("text", ""))
        if not looks_like_schedule_text(text):
            continue
        items.append(
            item_from_text(
                source_url=source_url,
                text=text,
                title=candidate.get("title", ""),
                link=candidate.get("link", ""),
            )
        )
    return items


async def click_and_scrape_days(page: Any, args: argparse.Namespace) -> list[dict[str, str]]:
    patterns = compile_patterns(args.click_text)
    clicked_texts: set[str] = set()
    total_clicks = 0
    items: list[dict[str, str]] = []

    items.extend(await extract_visible_items(page, page.url, args.candidate_selector))

    for pattern in patterns:
        if total_clicks >= args.max_clicks:
            break

        locator = page.locator(args.click_selector).filter(has_text=pattern)
        try:
            count = await locator.count()
        except Exception as exc:
            print(f"Could not inspect controls for {pattern.pattern!r}: {exc}", file=sys.stderr)
            continue

        for index in range(count):
            if total_clicks >= args.max_clicks:
                break

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

                print(f"Clicking read-only scrape control: {text[:100]!r}")
                await candidate.click(timeout=5000, no_wait_after=True)
                await page.wait_for_timeout(args.settle_ms)
                clicked_texts.add(text.lower())
                total_clicks += 1
                items.extend(await extract_visible_items(page, page.url, args.candidate_selector))
                break
            except Exception as exc:
                print(f"Skipping control match {pattern.pattern!r} at index {index}: {exc}", file=sys.stderr)

    return dedupe_items(items)


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

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=not args.headful)
        context_kwargs: dict[str, Any] = {
            "user_agent": "ProPickleAvailabilityHelper/0.1 read-only DOM scraper",
        }
        if args.storage_state:
            context_kwargs["storage_state"] = args.storage_state

        context = await browser.new_context(**context_kwargs)

        cookie_header = load_cookie_header()
        if cookie_header:
            await context.add_cookies(cookie_header_to_playwright_cookies(cookie_header, args.url))

        page = await context.new_page()
        page.set_default_timeout(args.timeout_ms)

        print(f"Opening {args.url}")
        await page.goto(args.url, wait_until="domcontentloaded", timeout=args.timeout_ms)
        await page.wait_for_timeout(args.settle_ms)

        items = await click_and_scrape_days(page, args)
        write_json(args.output_json, items)
        write_csv(args.output_csv, items)
        print(f"Wrote {len(items)} availability item(s) to {args.output_json} and {args.output_csv}.")

        await browser.close()

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(run()))
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        raise SystemExit(130)
