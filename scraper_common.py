from __future__ import annotations

import csv
import json
import os
import re
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse


DEFAULT_URL = "https://book.propickle.com.au/f/ProPickle/booking_waiver"

FIELDNAMES = [
    "source_url",
    "title",
    "date",
    "start_time",
    "end_time",
    "status",
    "price",
    "link",
]

DEFAULT_DAY_PATTERNS = [
    r"\bMon(?:day)?\b",
    r"\bTue(?:sday)?\b",
    r"\bWed(?:nesday)?\b",
    r"\bThu(?:rsday)?\b",
    r"\bFri(?:day)?\b",
    r"\bSat(?:urday)?\b",
    r"\bSun(?:day)?\b",
]

DANGEROUS_CONTROL_WORDS = {
    "agree",
    "book",
    "cart",
    "checkout",
    "confirm",
    "login",
    "pay",
    "payment",
    "purchase",
    "reserve",
    "sign in",
    "submit",
}

MONTH_RE = (
    r"Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|"
    r"Nov(?:ember)?|Dec(?:ember)?"
)

DATE_PATTERNS = [
    re.compile(
        rf"\b(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|"
        rf"Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)?,?\s*"
        rf"\d{{1,2}}\s+(?:{MONTH_RE})(?:\s+\d{{4}})?\b",
        re.IGNORECASE,
    ),
    re.compile(rf"\b\d{{1,2}}\s+(?:{MONTH_RE})\s+\d{{4}}\b", re.IGNORECASE),
    re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
    re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b"),
]

TIME_RANGE_RE = re.compile(
    r"\b("
    r"\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?"
    r")\s*(?:-|–|—|to)\s*("
    r"\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?"
    r")\b"
)

SINGLE_TIME_RE = re.compile(r"\b\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)\b")
PERIOD_RE = re.compile(r"(am|pm)$", re.IGNORECASE)
HOUR_RE = re.compile(r"^(\d{1,2})(?::\d{2})?")
PRICE_RE = re.compile(r"\b(?:A\$|AU\$|\$)\s*\d+(?:\.\d{2})?\b")
TIME_RE = re.compile(r"^(\d{1,2})(?::(\d{2}))?(am|pm)$", re.IGNORECASE)


def normalize_whitespace(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def absolute_url(base_url: str, maybe_url: str | None) -> str:
    if not maybe_url:
        return ""
    return urljoin(base_url, maybe_url)


def extract_date(text: str) -> str:
    for pattern in DATE_PATTERNS:
        match = pattern.search(text)
        if match:
            return normalize_whitespace(match.group(0).strip(" ,"))
    return ""


def extract_times(text: str) -> tuple[str, str]:
    range_match = TIME_RANGE_RE.search(text)
    if range_match:
        return normalize_time_range(range_match.group(1), range_match.group(2))

    single_match = SINGLE_TIME_RE.search(text)
    if single_match:
        return normalize_whitespace(single_match.group(0)), ""

    return "", ""


def normalize_time_range(start_time: str, end_time: str) -> tuple[str, str]:
    start = normalize_whitespace(start_time).lower().replace(" ", "")
    end = normalize_whitespace(end_time).lower().replace(" ", "")
    start_period = PERIOD_RE.search(start)
    end_period = PERIOD_RE.search(end)

    if not start_period and end_period:
        period = end_period.group(1).lower()
        start_hour_match = HOUR_RE.search(start)
        end_hour_match = HOUR_RE.search(end)
        if start_hour_match and end_hour_match:
            start_hour = int(start_hour_match.group(1))
            end_hour = int(end_hour_match.group(1))
            if period == "pm" and end_hour == 12 and start_hour < 12:
                start = f"{start}am"
            else:
                start = f"{start}{period}"

    return start, end


def time_to_minutes(value: str) -> int:
    match = TIME_RE.match(normalize_whitespace(value).lower().replace(" ", ""))
    if not match:
        raise ValueError(f"Unsupported time value: {value!r}")

    hour = int(match.group(1))
    minute = int(match.group(2) or "0")
    period = match.group(3).lower()

    if hour == 12:
        hour = 0
    if period == "pm":
        hour += 12

    return hour * 60 + minute


def minutes_to_time(minutes: int) -> str:
    hour24, minute = divmod(minutes, 60)
    period = "am" if hour24 < 12 or hour24 == 24 else "pm"
    hour = hour24 % 12
    if hour == 0:
        hour = 12
    suffix = f":{minute:02d}" if minute else ""
    return f"{hour}{suffix}{period}"


def merge_open_intervals(items: Iterable[dict[str, object]]) -> list[dict[str, str]]:
    grouped: dict[tuple[str, str, str, str, str], list[tuple[int, int]]] = {}

    for raw_item in items:
        item = ensure_item_shape(raw_item)
        if item["status"] != "open" or not item["start_time"] or not item["end_time"]:
            continue
        try:
            start = time_to_minutes(item["start_time"])
            end = time_to_minutes(item["end_time"])
        except ValueError:
            continue
        if end <= start:
            continue
        key = (
            item["source_url"],
            item["title"],
            item["date"],
            item["price"],
            item["link"],
        )
        grouped.setdefault(key, []).append((start, end))

    merged_items: list[dict[str, str]] = []
    for key, intervals in grouped.items():
        intervals.sort()
        merged: list[tuple[int, int]] = []
        for start, end in intervals:
            if not merged or start > merged[-1][1]:
                merged.append((start, end))
            else:
                previous_start, previous_end = merged[-1]
                merged[-1] = (previous_start, max(previous_end, end))

        source_url, title, date, price, link = key
        for start, end in merged:
            merged_items.append(
                ensure_item_shape(
                    {
                        "source_url": source_url,
                        "title": title,
                        "date": date,
                        "start_time": minutes_to_time(start),
                        "end_time": minutes_to_time(end),
                        "status": "open",
                        "price": price,
                        "link": link,
                    }
                )
            )

    return merged_items


def extract_price(text: str) -> str:
    match = PRICE_RE.search(text)
    return normalize_whitespace(match.group(0)) if match else ""


def guess_status(text: str) -> str:
    lower = text.lower()

    # Check closed/full words first because "unavailable" contains "available".
    full_words = [
        "fully booked",
        "sold out",
        "unavailable",
        "waitlist",
        "waiting list",
        "closed",
        "full",
    ]
    if any(word in lower for word in full_words):
        return "full"

    open_words = [
        "spots available",
        "spaces available",
        "available",
        "book now",
        "open",
    ]
    if any(word in lower for word in open_words):
        return "open"

    return "unknown"


def looks_like_schedule_text(text: str) -> bool:
    normalized = normalize_whitespace(text)
    if len(normalized) < 8 or len(normalized) > 1200:
        return False

    has_date = bool(extract_date(normalized))
    has_time = bool(TIME_RANGE_RE.search(normalized) or SINGLE_TIME_RE.search(normalized))
    has_price = bool(extract_price(normalized))
    has_status = guess_status(normalized) != "unknown"

    return has_date or has_time or (has_price and has_status)


def title_from_text(text: str) -> str:
    lines = [normalize_whitespace(line) for line in (text or "").splitlines()]
    for line in lines:
        if not line:
            continue
        if extract_date(line) or TIME_RANGE_RE.search(line) or PRICE_RE.search(line):
            continue
        if len(line) <= 120:
            return line
    return lines[0][:120] if lines else ""


def item_from_text(
    *,
    source_url: str,
    text: str,
    link: str = "",
    title: str = "",
) -> dict[str, str]:
    normalized = normalize_whitespace(text)
    start_time, end_time = extract_times(normalized)
    return ensure_item_shape(
        {
            "source_url": source_url,
            "title": normalize_whitespace(title) or title_from_text(text),
            "date": extract_date(normalized),
            "start_time": start_time,
            "end_time": end_time,
            "status": guess_status(normalized),
            "price": extract_price(normalized),
            "link": absolute_url(source_url, link),
        }
    )


def ensure_item_shape(item: dict[str, object]) -> dict[str, str]:
    return {field: normalize_whitespace(str(item.get(field, "") or "")) for field in FIELDNAMES}


def dedupe_items(items: Iterable[dict[str, object]]) -> list[dict[str, str]]:
    seen: set[tuple[str, ...]] = set()
    deduped: list[dict[str, str]] = []

    for raw_item in items:
        item = ensure_item_shape(raw_item)
        key = tuple(item[field].lower() for field in FIELDNAMES)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    return deduped


def write_json(path: str | Path, data: object) -> None:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_csv(path: str | Path, items: Iterable[dict[str, object]]) -> None:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELDNAMES)
        writer.writeheader()
        for item in items:
            writer.writerow(ensure_item_shape(item))


def load_cookie_header() -> str:
    # Optional: paste browser cookies into this env var when inspecting pages
    # you can access normally. Do not use this to bypass auth or access rules.
    return os.getenv("PROPPICKLE_COOKIE_HEADER", "").strip()


def cookie_header_to_playwright_cookies(cookie_header: str, source_url: str) -> list[dict[str, object]]:
    parsed = urlparse(source_url)
    if not parsed.hostname:
        return []

    cookies: list[dict[str, object]] = []
    for part in cookie_header.split(";"):
        if "=" not in part:
            continue
        name, value = part.strip().split("=", 1)
        if not name:
            continue
        cookies.append(
            {
                "name": name,
                "value": value,
                "domain": parsed.hostname,
                "path": "/",
                "secure": parsed.scheme == "https",
            }
        )
    return cookies


def is_dangerous_control_text(text: str) -> bool:
    lower = normalize_whitespace(text).lower()
    return any(word in lower for word in DANGEROUS_CONTROL_WORDS)


def redact_sensitive_text(text: str) -> str:
    patterns = [
        re.compile(
            r'(?i)("?(?:access_token|refresh_token|id_token|token|session|authorization|cookie)"?\s*[:=]\s*)("[^"]+"|[^\s,}]+)'
        ),
        re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._~+/=-]+"),
    ]

    redacted = text
    for pattern in patterns:
        redacted = pattern.sub(r"\1<redacted>", redacted)
    return redacted
