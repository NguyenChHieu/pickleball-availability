const { bookingActionUrlForDay, bookingUrlForDay } = require("./bookingLinks");
const { formatDateTime } = require("./formatAvailability");

const STALE_THRESHOLD_HOURS = 12;
const STALE_THRESHOLD_MS = STALE_THRESHOLD_HOURS * 60 * 60 * 1000;
const DEFAULT_VENUE = Object.freeze({
  fallbackUrl: "",
  themeId: "venue",
  venueName: "Venue",
});
const VENUE_METADATA = Object.freeze({
  propickle: Object.freeze({
    fallbackUrl: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true",
    themeId: "propickle",
    venueName: "ProPickle",
  }),
});

function metadataForVenue(venueId, payload) {
  const metadata = VENUE_METADATA[venueId] || DEFAULT_VENUE;
  return {
    fallbackUrl: bookingUrlForDay({}, payload) || metadata.fallbackUrl,
    themeId: metadata.themeId || venueId || DEFAULT_VENUE.themeId,
    venueName: payload?.venue_name || metadata.venueName || venueId || DEFAULT_VENUE.venueName,
  };
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function intervalLabel(interval) {
  return `${interval.start_time || interval.startTime || "?"}-${interval.end_time || interval.endTime || "?"}`;
}

function normalizeInterval(interval) {
  const startTime = interval?.start_time || interval?.startTime || "";
  const endTime = interval?.end_time || interval?.endTime || "";
  return {
    startTime,
    endTime,
    label: intervalLabel(interval),
  };
}

function normalizeDay(day, payload) {
  const openIntervals = Array.isArray(day?.open_intervals) ? day.open_intervals : [];
  return {
    date: day?.date || "Unknown date",
    title: day?.title || "Court booking",
    totalOpenHours: numberOrZero(day?.remaining_hours),
    openIntervals: openIntervals.map(normalizeInterval),
    bookingUrl: bookingActionUrlForDay(day, payload),
  };
}

function isStaleTimestamp(lastReadAt, now) {
  if (!lastReadAt) return false;
  const readTime = new Date(lastReadAt).getTime();
  const nowTime = new Date(now || Date.now()).getTime();
  if (!Number.isFinite(readTime) || !Number.isFinite(nowTime)) return false;
  return nowTime - readTime > STALE_THRESHOLD_MS;
}

function buildPublicAvailabilityResponse(record, { venueId = "venue", now } = {}) {
  if (!record?.payload || !Array.isArray(record.payload.days)) {
    const metadata = metadataForVenue(venueId);
    return {
      status: 404,
      body: {
        state: "empty",
        message: "No cached availability yet.",
        fallbackUrl: metadata.fallbackUrl,
      },
    };
  }

  const payload = record.payload;
  const metadata = metadataForVenue(venueId, payload);
  const lastReadAt = payload.exported_at || record.received_at || null;
  const days = payload.days.map((day) => normalizeDay(day, payload));

  return {
    status: 200,
    body: {
      state: "ready",
      venueId,
      venueName: metadata.venueName,
      themeId: metadata.themeId,
      lastReadAt,
      freshnessLabel: formatDateTime(lastReadAt),
      isStale: isStaleTimestamp(lastReadAt, now),
      staleThresholdHours: STALE_THRESHOLD_HOURS,
      summary: {
        dayCount: days.length,
        totalOpenHours: days.reduce((total, day) => total + day.totalOpenHours, 0),
      },
      days,
      fallbackUrl: metadata.fallbackUrl,
    },
  };
}

module.exports = {
  buildPublicAvailabilityResponse,
  STALE_THRESHOLD_HOURS,
};
