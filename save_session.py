from __future__ import annotations

import argparse
import asyncio
import sys
from typing import Any

from scraper_common import DEFAULT_URL


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Open ProPickle/Playbypoint in a real browser so you can log in and "
            "manually accept any required waiver/conditions, then save local "
            "Playwright storage state for read-only scraper runs."
        )
    )
    parser.add_argument("--url", default=DEFAULT_URL, help="Page to open for login/session setup.")
    parser.add_argument(
        "--output",
        default="auth_state.json",
        help="Local Playwright storage state file. Keep this private and gitignored.",
    )
    parser.add_argument("--timeout-ms", type=int, default=120000)
    return parser.parse_args()


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
        browser = await playwright.chromium.launch(headless=False)
        context = await browser.new_context(
            user_agent="ProPickleAvailabilityHelper/0.1 manual session capture"
        )
        page = await context.new_page()
        page.set_default_timeout(args.timeout_ms)

        print(f"Opening {args.url}")
        await page.goto(args.url, wait_until="domcontentloaded", timeout=args.timeout_ms)
        print()
        print("Use the browser window to log in normally.")
        print("If a waiver/conditions page appears, only accept it manually if you genuinely agree.")
        print("Do not enter payment or complete an actual booking.")
        print()
        input("After the real availability page is visible, press Enter here to save the session...")

        await context.storage_state(path=args.output)
        await browser.close()

    print(f"Saved local auth/session state to {args.output}")
    print(f"Use it with: python discover_endpoints.py --storage-state {args.output} --headful")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(run()))
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        raise SystemExit(130)
