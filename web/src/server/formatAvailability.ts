import type { AvailabilityPayload, AvailabilityPayloadDay } from "./availabilityStore";

type PayloadsByVenue = Record<string, AvailabilityPayload | null | undefined>;

export function formatDateTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  });
}

function stringField(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function formatInterval(interval: Record<string, unknown>) {
  return `${stringField(interval.start_time)}-${stringField(interval.end_time)}`;
}

export function formatDay(day: AvailabilityPayloadDay) {
  const intervals = Array.isArray(day.open_intervals) ? day.open_intervals : [];
  const sameCourtIntervals = Array.isArray(day.same_court_intervals) ? day.same_court_intervals : [];
  const levelIntervals = Array.isArray(day.level_intervals) ? day.level_intervals : [];
  const continuityStatus = stringField(day.continuity_status);
  const label = day.date || "Unknown date";
  if (!intervals.length) return `${label}: no open intervals`;

  const times = intervals.map((interval) => formatInterval(interval as Record<string, unknown>)).join(", ");
  const hours = Number(day.remaining_hours || 0);
  const hoursLabel = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
  const suffix = hours > 0 ? ` (${hoursLabel}h)` : "";
  const sameCourt = sameCourtIntervals
    .map((group) => {
      const courtName = group.court_name || group.courtName || group.resource_name || group.provider_name || "";
      const levelName = group.level_name ? ` ${group.level_name}` : "";
      const price = group.price ? ` ${group.price}` : "";
      const courtTimes = Array.isArray(group.intervals)
        ? group.intervals.map((interval) => formatInterval(interval as Record<string, unknown>)).join(", ")
        : "";
      return courtName && courtTimes ? `${courtName}${levelName}${price}: ${courtTimes}` : "";
    })
    .filter(Boolean)
    .join("; ");
  const levels = levelIntervals
    .map((group) => {
      const levelName = group.level_name || group.levelName || group.title || group.service_name || "";
      const levelTimes = Array.isArray(group.intervals)
        ? group.intervals.map((interval) => formatInterval(interval as Record<string, unknown>)).join(", ")
        : "";
      const price = group.price ? ` ${group.price}` : "";
      return levelName && levelTimes ? `${levelName}${price}: ${levelTimes}` : "";
    })
    .filter(Boolean)
    .join("; ");
  const continuityNote =
    continuityStatus === "failed"
      ? "; courts/providers could not be read"
      : continuityStatus === "partial"
        ? "; courts/providers partially read"
        : continuityStatus === "not_scanned"
          ? "; courts/providers not scanned"
        : "";
  return `${label}: any court ${times}${suffix}${levels ? `; levels ${levels}` : ""}${sameCourt ? `; courts/providers ${sameCourt}` : ""}${continuityNote}`;
}

export function formatAvailability(payload: AvailabilityPayload | null | undefined, { maxDays = 8 } = {}) {
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

export function answerForMessage(text: unknown, payloadsByVenue: PayloadsByVenue) {
  const normalized = String(text || "").toLowerCase();
  if (!normalized.trim()) return "Ask me: availability propickle, broadway, north ryde, sydney racquet, or house of pickle";

  const wantsBroadway = normalized.includes("broadway");
  const wantsNorthRyde = normalized.includes("north ryde") || normalized.includes("northryde");
  const wantsHouseOfPickle =
    normalized.includes("house of pickle") ||
    normalized.includes("darling harbour") ||
    normalized.includes("houseofpickle") ||
    /\bhop\b/.test(normalized);
  const wantsSydneyRacquet =
    normalized.includes("sydney racquet") ||
    normalized.includes("racquet club") ||
    normalized.includes("playtomic");
  const wantsProPickle =
    normalized.includes("propickle") ||
    normalized.includes("pro pickle") ||
    normalized.includes("pro pico") ||
    normalized.includes("pickle");

  if (wantsBroadway) return formatAvailability(payloadsByVenue.broadway);
  if (wantsNorthRyde) return formatAvailability(payloadsByVenue.northryde);
  if (wantsHouseOfPickle) return formatAvailability(payloadsByVenue["houseofpickle-darlingharbour"]);
  if (wantsSydneyRacquet) return formatAvailability(payloadsByVenue.sydneyracquet);
  if (wantsProPickle || normalized.includes("availability") || normalized.includes("available")) {
    return formatAvailability(payloadsByVenue.propickle);
  }

  return "Ask me: availability propickle, broadway, north ryde, sydney racquet, or house of pickle";
}
