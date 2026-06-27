from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


FIELDS = ["source_url", "title", "date", "start_time", "end_time", "status", "price", "link"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert browser_export.js output into interval-focused JSON/CSV files."
    )
    parser.add_argument("--input", default="browser_availability.json")
    parser.add_argument("--summary-json", default="remaining_hours.json")
    parser.add_argument("--intervals-json", default="availability_intervals.json")
    parser.add_argument("--intervals-csv", default="availability_intervals.csv")
    parser.add_argument("--raw-slots-json", default="availability.json")
    parser.add_argument("--raw-slots-csv", default="availability.csv")
    return parser.parse_args()


def write_json(path: str, data: Any) -> None:
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_csv(path: str, rows: list[dict[str, Any]]) -> None:
    with Path(path).open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in FIELDS})


def flatten_intervals(days: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for day in days:
        for interval in day.get("open_intervals", []):
            rows.append(
                {
                    "source_url": day.get("source_url", ""),
                    "title": day.get("title", ""),
                    "date": day.get("date", ""),
                    "start_time": interval.get("start_time", ""),
                    "end_time": interval.get("end_time", ""),
                    "status": "open",
                    "price": "",
                    "link": day.get("source_url", ""),
                }
            )
    return rows


def flatten_raw_slots(days: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for day in days:
        for slot in day.get("raw_slots", []):
            rows.append(
                {
                    "source_url": day.get("source_url", ""),
                    "title": slot.get("title", day.get("title", "")),
                    "date": slot.get("date", day.get("date", "")),
                    "start_time": slot.get("start_time", ""),
                    "end_time": slot.get("end_time", ""),
                    "status": slot.get("status", "unknown"),
                    "price": "",
                    "link": day.get("source_url", ""),
                }
            )
    return rows


def normalize_day(day: dict[str, Any]) -> dict[str, Any]:
    # Keep the summary interval-first. remaining_hours is convenience metadata,
    # not the main answer.
    return {
        "source_url": day.get("source_url", ""),
        "title": day.get("title", ""),
        "date": day.get("date", ""),
        "open_intervals": day.get("open_intervals", []),
        "remaining_hours": day.get("remaining_hours", 0),
    }


def main() -> int:
    args = parse_args()
    payload = json.loads(Path(args.input).read_text(encoding="utf-8-sig"))
    source_days = payload.get("days", [])
    days = [normalize_day(day) for day in source_days]
    interval_rows = flatten_intervals(source_days)
    raw_slot_rows = flatten_raw_slots(source_days)

    write_json(args.summary_json, days)
    write_json(args.intervals_json, interval_rows)
    write_csv(args.intervals_csv, interval_rows)
    write_json(args.raw_slots_json, raw_slot_rows)
    write_csv(args.raw_slots_csv, raw_slot_rows)

    print(f"Wrote {len(days)} day summaries to {args.summary_json}.")
    print(f"Wrote {len(interval_rows)} open interval rows to {args.intervals_json} and {args.intervals_csv}.")
    print(f"Wrote {len(raw_slot_rows)} raw slot rows to {args.raw_slots_json} and {args.raw_slots_csv}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
