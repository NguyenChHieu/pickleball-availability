function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  });
}

function formatInterval(interval) {
  return `${interval.start_time}-${interval.end_time}`;
}

function formatDay(day) {
  const intervals = day.open_intervals || [];
  const label = day.date || "Unknown date";
  if (!intervals.length) return `${label}: no open intervals`;

  const times = intervals.map(formatInterval).join(", ");
  const hours = Number(day.remaining_hours || 0);
  const hoursLabel = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
  const suffix = hours > 0 ? ` (${hoursLabel}h)` : "";
  return `${label}: ${times}${suffix}`;
}

function formatAvailability(payload, { maxDays = 8 } = {}) {
  if (!payload || !Array.isArray(payload.days)) {
    return "No availability has been loaded yet.";
  }

  const venueName = payload.venue_name || "Venue";
  const exportedAt = formatDateTime(payload.exported_at);
  const lines = [`${venueName} availability${exportedAt ? `, last read ${exportedAt}` : ""}:`];

  const days = payload.days.slice(0, maxDays);
  if (!days.length) {
    lines.push("No days were found.");
  } else {
    for (const day of days) lines.push(formatDay(day));
  }

  if (payload.days.length > days.length) {
    lines.push(`...and ${payload.days.length - days.length} more day(s).`);
  }

  return lines.join("\n");
}

function answerForMessage(text, payloadsByVenue) {
  const normalized = String(text || "").toLowerCase();
  if (!normalized.trim()) return "Ask me: availability propickle";

  const wantsProPickle =
    normalized.includes("propickle") ||
    normalized.includes("pro pickle") ||
    normalized.includes("pro pico") ||
    normalized.includes("pickle");

  if (wantsProPickle || normalized.includes("availability") || normalized.includes("available")) {
    return formatAvailability(payloadsByVenue.propickle);
  }

  return "Ask me: availability propickle";
}

module.exports = {
  answerForMessage,
  formatAvailability,
  formatDateTime,
  formatDay,
  formatInterval,
};
