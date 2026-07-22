import { getVenueDefinition } from "../lib/venues.ts";
import type { AvailabilityPayload, AvailabilityPayloadDay, AvailabilityRecord } from "./availabilityStore.ts";
import { bookingActionUrlForDay, bookingUrlForDay } from "./bookingLinks.ts";
import { formatDateTime } from "./formatAvailability.ts";

export const STALE_THRESHOLD_MINUTES = 5;

const STALE_THRESHOLD_MS = STALE_THRESHOLD_MINUTES * 60 * 1000;
const DEFAULT_VENUE = Object.freeze({
  fallbackUrl: "",
  themeId: "venue",
  venueName: "Venue",
});

function metadataForVenue(venueId: string, payload?: AvailabilityPayload | null) {
  const venue = getVenueDefinition(venueId);
  return {
    fallbackUrl: bookingUrlForDay({}, payload as Record<string, unknown>) || venue?.fallbackUrl || DEFAULT_VENUE.fallbackUrl,
    themeId: venue?.theme.id || venueId || DEFAULT_VENUE.themeId,
    venueName: payload?.venue_name || venue?.name || venueId || DEFAULT_VENUE.venueName,
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

function normalizeCourtIntervals(group: Record<string, unknown>) {
  const courtName = String(group?.court_name || group?.courtName || group?.resource_name || group?.provider_name || "");
  const intervals = Array.isArray(group?.intervals) ? group.intervals : [];
  return {
    courtName,
    providerName: String(group?.provider_name || group?.court_name || group?.courtName || ""),
    levelName: String(group?.level_name || group?.levelName || group?.title || group?.service_name || ""),
    price: String(group?.price || ""),
    intervals: intervals.map((interval) => normalizeInterval(interval as Record<string, unknown>)),
  };
}

function normalizeLevelIntervals(group: Record<string, unknown>) {
  const levelName = String(group?.level_name || group?.levelName || group?.title || group?.service_name || "");
  const intervals = Array.isArray(group?.intervals) ? group.intervals : [];
  return {
    levelName,
    price: String(group?.price || ""),
    intervals: intervals.map((interval) => normalizeInterval(interval as Record<string, unknown>)),
  };
}

function normalizeDay(day: AvailabilityPayloadDay, payload: AvailabilityPayload) {
  const openIntervals = Array.isArray(day?.open_intervals) ? day.open_intervals : [];
  const sameCourtIntervals = Array.isArray(day?.same_court_intervals) ? day.same_court_intervals : [];
  const levelIntervals = Array.isArray(day?.level_intervals) ? day.level_intervals : [];
  return {
    date: day?.date || "Unknown date",
    title: day?.title || "Court booking",
    totalOpenHours: numberOrZero(day?.remaining_hours),
    openIntervals: openIntervals.map((interval) => normalizeInterval(interval as Record<string, unknown>)),
    sameCourtIntervals: sameCourtIntervals
      .map((group) => normalizeCourtIntervals(group as Record<string, unknown>))
      .filter((group) => group.courtName && group.intervals.length),
    continuityStatus: String(day?.continuity_status || ""),
    levelIntervals: levelIntervals
      .map((group) => normalizeLevelIntervals(group as Record<string, unknown>))
      .filter((group) => group.levelName && group.intervals.length),
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
      staleThresholdMinutes: STALE_THRESHOLD_MINUTES,
      summary: {
        dayCount: days.length,
        totalOpenHours: days.reduce((total, day) => total + day.totalOpenHours, 0),
      },
      days,
      fallbackUrl: metadata.fallbackUrl,
    },
  } as const;
}
