from __future__ import annotations

import argparse
from pathlib import Path

from bs4 import BeautifulSoup

from scraper_common import (
    DEFAULT_URL,
    dedupe_items,
    item_from_text,
    looks_like_schedule_text,
    merge_open_intervals,
    normalize_time_range,
    normalize_whitespace,
    write_csv,
    write_json,
)

DAY_NAMES = {
    "Mon": "Monday",
    "Tue": "Tuesday",
    "Wed": "Wednesday",
    "Thu": "Thursday",
    "Fri": "Friday",
    "Sat": "Saturday",
    "Sun": "Sunday",
}

MONTHS = [
    ("Jan", "January"),
    ("Feb", "February"),
    ("Mar", "March"),
    ("Apr", "April"),
    ("May", "May"),
    ("Jun", "June"),
    ("Jul", "July"),
    ("Aug", "August"),
    ("Sep", "September"),
    ("Oct", "October"),
    ("Nov", "November"),
    ("Dec", "December"),
]

MONTH_LOOKUP = {
    value.lower(): abbr
    for abbr, full in MONTHS
    for value in (abbr, full)
}


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


def extract_bookbox_summaries(soup: BeautifulSoup, source_url: str) -> list[dict[str, object]]:
    bookbox = soup.select_one('[data-react-class="BookBox"]')
    if not bookbox:
        return []

    selected_date = selected_bookbox_date(bookbox)
    selected_type = selected_bookbox_type(bookbox) or "Court booking"
    day_dates = visible_bookbox_dates(bookbox, selected_date) or [selected_date]
    summaries: list[dict[str, object]] = []

    for date in day_dates:
        loaded = date == selected_date
        summaries.append(
            {
                "source_url": source_url,
                "title": selected_type,
                "date": date,
                "loaded": loaded,
            }
        )

    return summaries


def fallback_page_summaries(items: list[dict[str, str]]) -> list[dict[str, object]]:
    summaries: list[dict[str, object]] = []
    seen: set[tuple[str, str, str]] = set()

    for item in items:
        key = (item["source_url"], item["title"], item["date"])
        if key in seen:
            continue
        seen.add(key)
        summaries.append(
            {
                "source_url": item["source_url"],
                "title": item["title"],
                "date": item["date"],
                "loaded": True,
            }
        )

    return summaries


def visible_bookbox_dates(bookbox, selected_date: str) -> list[str]:
    days_range = bookbox.select_one(".DaysRangeOptions")
    if not days_range:
        return []

    groups = days_range.select(".range-container")
    selected_month = month_from_date_label(selected_date)
    explicit_months = [
        normalize_month(month.get_text(" ", strip=True))
        for month in days_range.select(".month")
    ]

    dates: list[str] = []
    for index, group in enumerate(groups):
        month = month_for_group(group, selected_month, explicit_months, index)
        for button in group.select(".day-container button"):
            day_name = normalize_whitespace(button.select_one(".day_name").get_text(" ")) if button.select_one(".day_name") else ""
            day_number = normalize_whitespace(button.select_one(".day_number").get_text(" ")) if button.select_one(".day_number") else ""
            if not day_name or not day_number:
                continue
            full_day_name = DAY_NAMES.get(day_name[:3].title(), day_name)
            dates.append(f"{full_day_name}, {month} {day_number.zfill(2)}")

    return dates


def month_for_group(group, selected_month: str, explicit_months: list[str], group_index: int) -> str:
    parent = group.parent
    explicit = parent.find("div", class_="month", recursive=False) if parent else None
    if explicit:
        return normalize_month(explicit.get_text(" ", strip=True))

    if group_index == 0 and explicit_months:
        return previous_month(explicit_months[0])

    return selected_month or (explicit_months[0] if explicit_months else "")


def month_from_date_label(date_label: str) -> str:
    parts = normalize_whitespace(date_label).replace(",", "").split()
    for part in parts:
        month = normalize_month(part)
        if month:
            return month
    return ""


def normalize_month(value: str) -> str:
    return MONTH_LOOKUP.get(normalize_whitespace(value).lower(), "")


def previous_month(month: str) -> str:
    abbreviations = [abbr for abbr, _full in MONTHS]
    if month not in abbreviations:
        return month
    index = abbreviations.index(month)
    return abbreviations[index - 1]


def loaded_status(summary: dict[str, object]) -> str:
    return "loaded" if bool(summary.get("loaded")) else "not_loaded"


def interval_summary_entry(
    summary: dict[str, object],
    open_intervals: list[dict[str, str]],
) -> dict[str, object]:
    loaded = bool(summary.get("loaded"))
    return (
        {
            "source_url": str(summary.get("source_url", "")),
            "title": str(summary.get("title", "")),
            "date": str(summary.get("date", "")),
            "loaded": loaded,
            "status": loaded_status(summary),
            "open_intervals": open_intervals if loaded else None,
            "remaining_hours": (
                sum(
                    interval_duration_hours(interval["start_time"], interval["end_time"])
                    for interval in open_intervals
                )
                if loaded
                else None
            ),
        }
    )


def summarize_remaining_hours(
    page_summaries: list[dict[str, object]],
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
        key = (
            str(summary.get("source_url", "")),
            str(summary.get("title", "")),
            str(summary.get("date", "")),
        )
        if key in seen:
            continue
        seen.add(key)
        open_intervals = grouped_intervals.get(key, [])
        summaries.append(interval_summary_entry(summary, open_intervals))

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
    page_summaries: list[dict[str, object]] = []
    for input_path in args.input:
        html_path = Path(input_path)
        html = html_path.read_text(encoding="utf-8", errors="replace")
        soup = clean_soup(html)
        page_summaries.extend(extract_bookbox_summaries(soup, args.source_url))
        items.extend(extract_items(soup, args.source_url))

    items = dedupe_items(items)
    intervals = merge_open_intervals(items)
    if not page_summaries:
        page_summaries = fallback_page_summaries(items)
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
