from __future__ import annotations

import argparse
from pathlib import Path

from bs4 import BeautifulSoup

from scraper_common import (
    DEFAULT_URL,
    dedupe_items,
    ensure_item_shape,
    item_from_text,
    looks_like_schedule_text,
    merge_open_intervals,
    normalize_time_range,
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
    parser.add_argument(
        "--input",
        required=True,
        nargs="+",
        help="Saved HTML file(s) from your normal browser. Save one file per selected day.",
    )
    parser.add_argument(
        "--source-url",
        default=DEFAULT_URL,
        help="Original page URL to store in output rows.",
    )
    parser.add_argument("--output-json", default="availability.json")
    parser.add_argument("--output-csv", default="availability.csv")
    parser.add_argument("--intervals-json", default="availability_intervals.json")
    parser.add_argument("--intervals-csv", default="availability_intervals.csv")
    parser.add_argument("--summary-json", default="remaining_hours.json")
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
    if soup.select_one('[data-react-class="BookBox"]'):
        return extract_bookbox_items(soup, source_url)

    bookbox_items = extract_bookbox_items(soup, source_url)
    if bookbox_items:
        return bookbox_items

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


def extract_bookbox_items(soup: BeautifulSoup, source_url: str) -> list[dict[str, str]]:
    bookbox = soup.select_one('[data-react-class="BookBox"]')
    if not bookbox:
        return []

    selected_date = selected_bookbox_date(bookbox)
    selected_type = selected_bookbox_type(bookbox) or "Court booking"
    time_buttons = bookbox.select(".ButtonOption")
    items: list[dict[str, str]] = []

    for button in time_buttons:
        text = normalize_whitespace(button.get_text(" "))
        if "-" not in text:
            continue
        if not any(char.isdigit() for char in text):
            continue

        clean_text = text.replace("+", "").strip()
        start_time, end_time = normalize_time_range(*clean_text.split("-", 1))
        classes = set(button.get("class", []))
        status = "full" if "red" in classes or button.has_attr("disabled") else "open"

        items.append(
            {
                "source_url": source_url,
                "title": selected_type,
                "date": selected_date,
                "start_time": start_time,
                "end_time": end_time,
                "status": status,
                "price": "",
                "link": source_url,
            }
        )

    return dedupe_items(items)


def extract_bookbox_summary(soup: BeautifulSoup, source_url: str) -> dict[str, str] | None:
    bookbox = soup.select_one('[data-react-class="BookBox"]')
    if not bookbox:
        return None

    return ensure_item_shape(
        {
            "source_url": source_url,
            "title": selected_bookbox_type(bookbox) or "Court booking",
            "date": selected_bookbox_date(bookbox),
            "start_time": "",
            "end_time": "",
            "status": "unknown",
            "price": "",
            "link": source_url,
        }
    )


def summarize_remaining_hours(
    page_summaries: list[dict[str, str]],
    intervals: list[dict[str, str]],
) -> list[dict[str, object]]:
    grouped_intervals: dict[tuple[str, str, str], list[dict[str, str]]] = {}
    for interval in intervals:
        key = (interval["source_url"], interval["title"], interval["date"])
        grouped_intervals.setdefault(key, []).append(
            {
                "start_time": interval["start_time"],
                "end_time": interval["end_time"],
            }
        )

    summaries: list[dict[str, object]] = []
    seen: set[tuple[str, str, str]] = set()
    for summary in page_summaries:
        key = (summary["source_url"], summary["title"], summary["date"])
        if key in seen:
            continue
        seen.add(key)
        open_intervals = grouped_intervals.get(key, [])
        summaries.append(
            {
                "source_url": summary["source_url"],
                "title": summary["title"],
                "date": summary["date"],
                "open_intervals": open_intervals,
                "remaining_hours": sum(
                    interval_duration_hours(interval["start_time"], interval["end_time"])
                    for interval in open_intervals
                ),
            }
        )

    return summaries


def interval_duration_hours(start_time: str, end_time: str) -> float:
    from scraper_common import time_to_minutes

    return (time_to_minutes(end_time) - time_to_minutes(start_time)) / 60


def selected_bookbox_date(bookbox) -> str:
    summary = bookbox.select_one(".StepperItem .summary")
    if summary:
        text = normalize_whitespace(summary.get_text(" "))
        if ", No time selected" in text:
            return text.split(", No time selected", 1)[0].strip()
        if ", " in text:
            return text.rsplit(", ", 1)[0].strip()

    selected_day = bookbox.select_one(".DaysRangeOptions .day-container button.primary")
    if selected_day:
        return normalize_whitespace(selected_day.get_text(" "))

    return ""


def selected_bookbox_type(bookbox) -> str:
    select_type_header = None
    for header in bookbox.select("h2"):
        if normalize_whitespace(header.get_text(" ")).lower() == "select type":
            select_type_header = header
            break

    if not select_type_header:
        return ""

    container = select_type_header.find_parent("div", class_="mb20")
    if not container:
        return ""

    selected_button = container.select_one(".ButtonOption.primary")
    if not selected_button:
        return ""

    return normalize_whitespace(selected_button.get_text(" "))


def main() -> int:
    args = parse_args()
    items: list[dict[str, str]] = []
    page_summaries: list[dict[str, str]] = []
    for input_path in args.input:
        html_path = Path(input_path)
        html = html_path.read_text(encoding="utf-8", errors="replace")
        soup = clean_soup(html)
        summary = extract_bookbox_summary(soup, args.source_url)
        if summary:
            page_summaries.append(summary)
        items.extend(extract_items(soup, args.source_url))

    items = dedupe_items(items)
    intervals = merge_open_intervals(items)
    if not page_summaries:
        page_summaries = [
            ensure_item_shape(
                {
                    "source_url": item["source_url"],
                    "title": item["title"],
                    "date": item["date"],
                    "link": item["link"],
                }
            )
            for item in items
        ]
    remaining_hours = summarize_remaining_hours(page_summaries, intervals)

    write_json(args.output_json, items)
    write_csv(args.output_csv, items)
    write_json(args.intervals_json, intervals)
    write_csv(args.intervals_csv, intervals)
    write_json(args.summary_json, remaining_hours)
    print(f"Wrote {len(items)} availability item(s) to {args.output_json} and {args.output_csv}.")
    print(
        f"Wrote {len(intervals)} merged open interval(s) to "
        f"{args.intervals_json} and {args.intervals_csv}."
    )
    print(f"Wrote {len(remaining_hours)} day summary item(s) to {args.summary_json}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
