import type { VenueDefinition } from "../lib/venues.ts";
import type { AvailabilityPayload } from "./availabilityStore.ts";
import { buildPublicAvailabilityResponse } from "./publicAvailability.ts";

export type DashboardVenue = Readonly<{
  id: string;
  name: string;
  platform: string;
  state: "fresh" | "stale" | "empty";
  freshnessLabel: string;
  lastReadAt: string | null;
  dayCount: number;
  totalOpenHours: number;
  nextOpening: string;
  nextOpeningDetail: string;
  fallbackUrl: string;
  accent: string;
}>;

function compactAge(value: string | null, now: Date | number | string) {
  if (!value) return "Not read yet";
  const readAt = new Date(value).getTime();
  const nowAt = new Date(now).getTime();
  if (!Number.isFinite(readAt) || !Number.isFinite(nowAt)) return "Read time unavailable";

  const minutes = Math.max(0, Math.floor((nowAt - readAt) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function shortDayLabel(value: string) {
  const raw = value.trim();
  const labelledDate = raw.match(/^([a-z]+),\s+([a-z]+)\s+(\d{1,2})$/i);
  if (labelledDate) {
    const [, weekday, month, day] = labelledDate;
    return `${weekday.slice(0, 3)}, ${Number(day)} ${month.slice(0, 3)}`;
  }

  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  if (!isIsoDate && !/\b\d{4}\b/.test(raw)) return raw || "Upcoming";

  const parsed = new Date(isIsoDate ? `${raw}T12:00:00Z` : raw);
  if (Number.isNaN(parsed.getTime())) return raw || "Upcoming";
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parsed);
}

function venueAccent(venue: VenueDefinition) {
  return venue.theme.colors.accent || "#aeea2f";
}

export function buildDashboardVenue(
  venue: VenueDefinition,
  payload: AvailabilityPayload | null | undefined,
  now: Date | number | string = Date.now()
): DashboardVenue {
  const record = payload
    ? {
        venue_id: venue.id,
        received_at: payload.exported_at || new Date(0).toISOString(),
        payload,
      }
    : null;
  const response = buildPublicAvailabilityResponse(record, { venueId: venue.id, now });

  if (response.status !== 200) {
    return {
      id: venue.id,
      name: venue.name,
      platform: venue.platform,
      state: "empty",
      freshnessLabel: "No cache",
      lastReadAt: null,
      dayCount: 0,
      totalOpenHours: 0,
      nextOpening: "No cached availability",
      nextOpeningDetail: "Refresh this venue to create its first saved result.",
      fallbackUrl: venue.fallbackUrl,
      accent: venueAccent(venue),
    };
  }

  const body = response.body;
  const firstOpenDay = body.days.find((day) => day.openIntervals.length > 0);
  const firstInterval = firstOpenDay?.openIntervals[0];

  return {
    id: venue.id,
    name: venue.name,
    platform: venue.platform,
    state: body.isStale ? "stale" : "fresh",
    freshnessLabel: body.isStale ? `Stale ${compactAge(body.lastReadAt, now)}` : `Fresh ${compactAge(body.lastReadAt, now)}`,
    lastReadAt: body.lastReadAt,
    dayCount: body.summary.dayCount,
    totalOpenHours: body.summary.totalOpenHours,
    nextOpening: firstInterval ? `${firstInterval.startTime}-${firstInterval.endTime}` : "No open intervals",
    nextOpeningDetail: firstOpenDay ? shortDayLabel(firstOpenDay.date) : "Across the saved date range",
    fallbackUrl: body.fallbackUrl || venue.fallbackUrl,
    accent: venueAccent(venue),
  };
}
