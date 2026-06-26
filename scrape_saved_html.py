from __future__ import annotations

import argparse
from pathlib import Path

from bs4 import BeautifulSoup

from scraper_common import (
    DEFAULT_URL,
    dedupe_items,
    item_from_text,
    looks_like_schedule_text,
    normalize_whitespace,
    write_csv,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Parse a locally saved ProPickle/Playbypoint availability HTML page. "
            "This makes no network requests and is useful when bot protection blocks automation."
        )
    )
    parser.add_argument("--input", required=True, help="Saved HTML file from your normal browser.")
    parser.add_argument(
        "--source-url",
        default=DEFAULT_URL,
        help="Original page URL to store in output rows.",
    )
    parser.add_argument("--output-json", default="availability.json")
    parser.add_argument("--output-csv", default="availability.csv")
    return parser.parse_args()


def clean_soup(html: str) -> BeautifulSoup:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    return soup


def heading_text(element) -> str:
    heading = element.select_one("h1, h2, h3, h4, h5, h6")
    if heading:
        return normalize_whitespace(heading.get_text(" "))
    anchor = element.find("a")
    if anchor:
        return normalize_whitespace(anchor.get_text(" "))
    return ""


def element_link(element) -> str:
    if getattr(element, "name", "") == "a" and element.get("href"):
        return element.get("href")
    anchor = element.find("a", href=True)
    return anchor.get("href") if anchor else ""


def candidate_elements(soup: BeautifulSoup):
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
        "[data-testid]",
    ]

    seen_ids: set[int] = set()
    for selector in selectors:
        for element in soup.select(selector):
            marker = id(element)
            if marker in seen_ids:
                continue
            seen_ids.add(marker)
            yield element


def extract_items(soup: BeautifulSoup, source_url: str) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for element in candidate_elements(soup):
        text = element.get_text("\n", strip=True)
        if not looks_like_schedule_text(text):
            continue
        items.append(
            item_from_text(
                source_url=source_url,
                text=text,
                title=heading_text(element),
                link=element_link(element),
            )
        )
    return dedupe_items(items)


def main() -> int:
    args = parse_args()
    html_path = Path(args.input)
    html = html_path.read_text(encoding="utf-8", errors="replace")
    items = extract_items(clean_soup(html), args.source_url)

    write_json(args.output_json, items)
    write_csv(args.output_csv, items)
    print(f"Wrote {len(items)} availability item(s) to {args.output_json} and {args.output_csv}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
