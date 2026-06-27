from __future__ import annotations

import argparse
import html
from pathlib import Path
from urllib.parse import quote


DEFAULT_SOURCE = "browser_export.js"
DEFAULT_BOOKMARKLET = "bookmarklet.txt"
DEFAULT_INSTALL_PAGE = "install_bookmarklet.html"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a draggable browser bookmarklet from browser_export.js."
    )
    parser.add_argument("--source", default=DEFAULT_SOURCE)
    parser.add_argument("--bookmarklet", default=DEFAULT_BOOKMARKLET)
    parser.add_argument("--install-page", default=DEFAULT_INSTALL_PAGE)
    return parser.parse_args()


def build_bookmarklet(source: str) -> str:
    return "javascript:" + quote(source, safe="")


def build_install_page(bookmarklet: str) -> str:
    escaped_href = html.escape(bookmarklet, quote=True)
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Install Playbypoint Availability Bookmarklet</title>
    <style>
      body {{
        color: #17202a;
        font-family: Arial, sans-serif;
        line-height: 1.5;
        margin: 40px;
        max-width: 760px;
      }}
      a.bookmarklet {{
        background: #0098c7;
        border-radius: 6px;
        color: #fff;
        display: inline-block;
        font-weight: 700;
        margin: 12px 0;
        padding: 10px 14px;
        text-decoration: none;
      }}
      code {{
        background: #eef2f4;
        border-radius: 4px;
        padding: 2px 5px;
      }}
      li {{
        margin-bottom: 8px;
      }}
    </style>
  </head>
  <body>
    <h1>Playbypoint Availability Bookmarklet</h1>
    <p>Drag this button to your bookmarks bar:</p>
    <p><a class="bookmarklet" href="{escaped_href}">Read Pickleball Availability</a></p>
    <ol>
      <li>Open a Playbypoint booking page in normal Chrome.</li>
      <li>Log in and accept any waiver manually if you genuinely agree.</li>
      <li>Click the bookmarklet.</li>
      <li>It reads visible day tabs, merges open intervals, and downloads <code>browser_availability.json</code>.</li>
      <li>Run <code>python parse_browser_export.py --input browser_availability.json</code> for CSV/JSON outputs.</li>
    </ol>
    <p>This tool is read-only except for clicking visible day tabs. It does not click Next, Book, checkout, payment, login, or waiver buttons.</p>
  </body>
</html>
"""


def main() -> int:
    args = parse_args()
    source = Path(args.source).read_text(encoding="utf-8")
    bookmarklet = build_bookmarklet(source)

    Path(args.bookmarklet).write_text(bookmarklet + "\n", encoding="utf-8")
    Path(args.install_page).write_text(build_install_page(bookmarklet), encoding="utf-8")

    print(f"Wrote {args.bookmarklet} ({len(bookmarklet)} characters).")
    print(f"Wrote {args.install_page}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
