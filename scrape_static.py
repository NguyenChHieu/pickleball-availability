from __future__ import annotations

import argparse
import sys
import time
from typing import Iterable

import requests
from bs4 import BeautifulSoup

from scraper_common import (
    DEFAULT_URL,
    absolute_url,
    dedupe_items,
    item_from_text,
    load_cookie_header,
    looks_like_schedule_text,
    normalize_whitespace,
    write_csv,
    write_json,
)


LINK_KEYWORDS = (
    "booking",
    "book",
    "court",
    "event",
    "program",
    "schedule",
    "session",
    "social",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape schedule-like data visible in public static HTML."
    )
    parser.add_argument("--url", default=DEFAULT_URL, help="Starting page URL.")
    parser.add_argument("--output-json", default="availability.json")
    parser.add_argument("--output-csv", default="availability.csv")
    parser.add_argument("--links-output", default="discovered_links.json")
    parser.add_argument("--timeout-seconds", type=float, default=20)
    parser.add_argument(
        "--follow-links",
        action="store_true",
        help="Fetch likely booking/program links found on the starting page.",
    )
    parser.add_argument("--max-pages", type=int, default=5, help="Limit for --follow-links.")
    parser.add_argument(
        "--delay-seconds",
        type=float,
        default=1.0,
        help="Polite delay between followed page requests.",
    )
    parser.add_argument(
        "--user-agent",
        default="ProPickleAvailabilityHelper/0.1 read-only static scraper",
    )
    return parser.parse_args()


def build_session(user_agent: str) -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": user_agent})

    cookie_header = load_cookie_header()
    if cookie_header:
        # Optional for pages you can access normally. Do not use this to bypass access controls.
        session.headers.update({"Cookie": cookie_header})

    return session


def fetch_html(session: requests.Session, url: str, timeout_seconds: float) -> str:
    response = session.get(url, timeout=timeout_seconds)
    response.raise_for_status()
    return response.text


def clean_soup(html: str) -> BeautifulSoup:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    return soup


def find_candidate_links(soup: BeautifulSoup, base_url: str) -> list[dict[str, str]]:
    links: list[dict[str, str]] = []
    seen: set[str] = set()

    for anchor in soup.find_all("a", href=True):
        text = normalize_whitespace(anchor.get_text(" "))
        href = absolute_url(base_url, anchor.get("href"))
        combined = f"{text} {href}".lower()
        if not any(keyword in combined for keyword in LINK_KEYWORDS):
            continue
        if href in seen:
            continue
        seen.add(href)
        links.append({"text": text, "url": href})

    return links


def heading_text(element) -> str:
    heading = element.select_one("h1, h2, h3, h4, h5, h6")
    if heading:
        return normalize_whitespace(heading.get_text(" "))
    anchor = element.find("a")
    if anchor:
        return normalize_whitespace(anchor.get_text(" "))
    return ""


def element_link(element, page_url: str) -> str:
    if getattr(element, "name", "") == "a" and element.get("href"):
        return absolute_url(page_url, element.get("href"))
    anchor = element.find("a", href=True)
    return absolute_url(page_url, anchor.get("href")) if anchor else ""


def candidate_elements(soup: BeautifulSoup) -> Iterable:
    selectors = [
        "tr",
        "article",
        "li",
        "[class*='card']",
        "[class*='event']",
        "[class*='program']",
        "[class*='schedule']",
        "[class*='session']",
        "[class*='booking']",
    ]

    seen_ids: set[int] = set()
    for selector in selectors:
        for element in soup.select(selector):
            marker = id(element)
            if marker in seen_ids:
                continue
            seen_ids.add(marker)
            yield element


def extract_items_from_soup(soup: BeautifulSoup, page_url: str) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []

    for element in candidate_elements(soup):
        text = element.get_text("\n", strip=True)
        if not looks_like_schedule_text(text):
            continue
        items.append(
            item_from_text(
                source_url=page_url,
                text=text,
                title=heading_text(element),
                link=element_link(element, page_url),
            )
        )

    return dedupe_items(items)


def main() -> int:
    args = parse_args()
    session = build_session(args.user_agent)

    pages_to_fetch = [args.url]
    all_items: list[dict[str, str]] = []
    discovered_links: list[dict[str, str]] = []

    try:
        html = fetch_html(session, args.url, args.timeout_seconds)
    except requests.RequestException as exc:
        print(f"Failed to fetch {args.url}: {exc}", file=sys.stderr)
        return 1

    soup = clean_soup(html)
    discovered_links = find_candidate_links(soup, args.url)
    all_items.extend(extract_items_from_soup(soup, args.url))

    if args.follow_links:
        for link in discovered_links[: args.max_pages - 1]:
            page_url = link["url"]
            if page_url in pages_to_fetch:
                continue
            pages_to_fetch.append(page_url)
            time.sleep(max(args.delay_seconds, 0))
            try:
                linked_html = fetch_html(session, page_url, args.timeout_seconds)
            except requests.RequestException as exc:
                print(f"Skipping {page_url}: {exc}", file=sys.stderr)
                continue
            linked_soup = clean_soup(linked_html)
            all_items.extend(extract_items_from_soup(linked_soup, page_url))

    items = dedupe_items(all_items)
    write_json(args.output_json, items)
    write_csv(args.output_csv, items)
    write_json(args.links_output, discovered_links)

    print(f"Discovered {len(discovered_links)} likely booking/program link(s).")
    print(f"Wrote {len(items)} availability item(s) to {args.output_json} and {args.output_csv}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
