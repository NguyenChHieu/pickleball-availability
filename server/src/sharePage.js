const { formatDateTime } = require("./formatAvailability");
const { bookingActionUrlForDay } = require("./bookingLinks");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function intervalLabel(interval) {
  return `${interval.start_time || "?"}-${interval.end_time || "?"}`;
}

function renderIntervalChips(day) {
  const intervals = Array.isArray(day?.open_intervals) ? day.open_intervals : [];
  if (!intervals.length) return '<p class="empty">No open intervals</p>';

  return `<div class="chips">${intervals
    .map((interval) => `<span class="chip">${escapeHtml(intervalLabel(interval))}</span>`)
    .join("")}</div>`;
}

function renderBookingActions(day, payload) {
  const dayUrl = bookingActionUrlForDay(day, payload);
  if (!dayUrl) return "";

  return `<div class="booking-actions">
    <a class="action" href="${escapeHtml(dayUrl)}" target="_blank" rel="noopener">Open booking</a>
  </div>`;
}

function renderDay(day, payload) {
  const hours = Number(day?.remaining_hours || 0);
  const hourLabel = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
  const title = day?.date || "Unknown date";
  const subtitle = day?.title || "Court booking";

  return `<section class="day">
    <div class="day-head">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p class="meta">${escapeHtml(subtitle)} - ${escapeHtml(hourLabel)} open hour(s)</p>
      </div>
      ${renderBookingActions(day, payload)}
    </div>
    ${renderIntervalChips(day)}
  </section>`;
}

function renderSharePage(payload, { venueId = "venue" } = {}) {
  const venueName = payload?.venue_name || venueId;
  const days = Array.isArray(payload?.days) ? payload.days : [];
  const lastUpdated = formatDateTime(payload?.exported_at);
  const hasPayload = Boolean(payload && Array.isArray(payload.days));

  const dayMarkup = hasPayload
    ? days.map((day) => renderDay(day, payload)).join("") ||
      '<section class="day"><p class="empty">No days were found.</p></section>'
    : '<section class="day"><p class="empty">No cached availability yet.</p></section>';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(venueName)} Availability</title>
    <style>
      :root {
        color: #17202a;
        font-family: Arial, sans-serif;
        font-size: 16px;
      }

      * {
        box-sizing: border-box;
      }

      body {
        background: #f5f8fa;
        margin: 0;
      }

      main {
        margin: 0 auto;
        max-width: 720px;
        min-height: 100vh;
        padding: 20px 16px 28px;
      }

      header {
        padding: 8px 0 18px;
      }

      h1 {
        font-size: 26px;
        line-height: 1.15;
        margin: 0 0 8px;
      }

      h2 {
        font-size: 17px;
        margin: 0 0 6px;
      }

      .muted,
      .meta,
      footer {
        color: #586873;
      }

      .muted {
        margin: 0;
      }

      .day {
        background: #fff;
        border: 1px solid #dce5e9;
        border-radius: 8px;
        margin: 0 0 12px;
        padding: 14px;
      }

      .meta {
        font-size: 13px;
        margin: 0 0 12px;
      }

      .day-head {
        align-items: flex-start;
        display: flex;
        gap: 12px;
        justify-content: space-between;
      }

      .booking-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
        margin-bottom: 12px;
      }

      .action {
        background: #0098c7;
        border: 1px solid #0098c7;
        border-radius: 6px;
        color: #fff;
        font-size: 13px;
        font-weight: 700;
        padding: 7px 9px;
        text-decoration: none;
        white-space: nowrap;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .chip {
        background: #e7f7fb;
        border: 1px solid #b8e3ee;
        border-radius: 999px;
        color: #0f5c70;
        font-weight: 700;
        padding: 7px 10px;
      }

      .empty {
        color: #8a3434;
        margin: 0;
      }

      footer {
        font-size: 12px;
        padding: 8px 2px 0;
      }

      @media (max-width: 560px) {
        .day-head {
          display: block;
        }

        .booking-actions {
          justify-content: flex-start;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(venueName)}</h1>
        <p class="muted">${lastUpdated ? `Last updated ${escapeHtml(lastUpdated)}` : "Cached availability"}</p>
      </header>
      ${dayMarkup}
      <footer>
        This read-only page shows the latest availability last scraped by the browser extension.
      </footer>
    </main>
  </body>
</html>`;
}

module.exports = {
  renderSharePage,
};
