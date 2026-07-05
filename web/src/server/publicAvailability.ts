import type { AvailabilityPayload, AvailabilityPayloadDay, AvailabilityRecord } from "./availabilityStore";
import { bookingActionUrlForDay, bookingUrlForDay } from "./bookingLinks";
import { formatDateTime } from "./formatAvailability";

export const STALE_THRESHOLD_HOURS = 12;

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
  broadway: Object.freeze({
    fallbackUrl: "https://clubspark.au/Broadway/Booking/BookByDate#?role=guest",
    themeId: "broadway",
    venueName: "Broadway Pickleball",
  }),
});

type VenueMetadata = {
  fallbackUrl: string;
  themeId: string;
  venueName: string;
};

function metadataForVenue(venueId: string, payload?: AvailabilityPayload | null) {
  const metadata =
    (VENUE_METADATA as Record<string, VenueMetadata | undefined>)[venueId] || DEFAULT_VENUE;
  return {
    fallbackUrl: bookingUrlForDay({}, payload as Record<string, unknown>) || metadata.fallbackUrl,
    themeId: metadata.themeId || venueId || DEFAULT_VENUE.themeId,
    venueName: payload?.venue_name || metadata.venueName || venueId || DEFAULT_VENUE.venueName,
  };
}

function numberOrZero(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function intervalLabel(interval: Record<string, unknown>) {
  return `${interval.start_time || interval.startTime || "?"}-${interval.end_time || interval.endTime || "?"}`;
}

function normalizeInterval(interval: Record<string, unknown>) {
  const startTime = String(interval?.start_time || interval?.startTime || "");
  const endTime = String(interval?.end_time || interval?.endTime || "");
  return {
    startTime,
    endTime,
    label: intervalLabel(interval),
  };
}

function normalizeDay(day: AvailabilityPayloadDay, payload: AvailabilityPayload) {
  const openIntervals = Array.isArray(day?.open_intervals) ? day.open_intervals : [];
  return {
    date: day?.date || "Unknown date",
    title: day?.title || "Court booking",
    totalOpenHours: numberOrZero(day?.remaining_hours),
    openIntervals: openIntervals.map((interval) => normalizeInterval(interval as Record<string, unknown>)),
    bookingUrl: bookingActionUrlForDay(
      day as Record<string, unknown>,
      payload as Record<string, unknown>
    ),
  };
}

function isStaleTimestamp(lastReadAt: string | null, now?: Date | number | string) {
  if (!lastReadAt) return false;
  const readTime = new Date(lastReadAt).getTime();
  const nowTime = new Date(now || Date.now()).getTime();
  if (!Number.isFinite(readTime) || !Number.isFinite(nowTime)) return false;
  return nowTime - readTime > STALE_THRESHOLD_MS;
}

export function buildPublicAvailabilityResponse(
  record: AvailabilityRecord | null,
  { venueId = "venue", now }: { venueId?: string; now?: Date | number | string } = {}
) {
  if (!record?.payload || !Array.isArray(record.payload.days)) {
    const metadata = metadataForVenue(venueId);
    return {
      status: 404,
      body: {
        state: "empty",
        message: "No cached availability yet.",
        fallbackUrl: metadata.fallbackUrl,
      },
    } as const;
  }

  const payload = record.payload;
  const metadata = metadataForVenue(venueId, payload);
  const lastReadAt = payload.exported_at || record.received_at || null;
  const payloadDays = payload.days || [];
  const days = payloadDays.map((day) => normalizeDay(day, payload));

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
  } as const;
}
