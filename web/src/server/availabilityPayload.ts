import { getVenueDefinition, type VenueDefinition } from "../lib/venues.ts";
import type {
  AvailabilityCourtIntervals,
  AvailabilityInterval,
  AvailabilityLevelIntervals,
  AvailabilityPayload,
  AvailabilityPayloadDay,
} from "./availabilityStore.ts";
import { parseTimeToMinutes } from "./plannerMatch.ts";

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_DAYS = 31;
const MAX_INTERVALS = 128;
const MAX_GROUPS = 64;
const MAX_FUTURE_EXPORT_MS = 5 * 60 * 1000;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export class InvalidAvailabilityPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAvailabilityPayloadError";
  }
}

function invalid(message: string): never {
  throw new InvalidAvailabilityPayloadError(`Invalid availability payload: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function boundedString(
  value: unknown,
  label: string,
  maxLength: number,
  { required = false }: { required?: boolean } = {}
) {
  if (value === undefined || value === null || value === "") {
    if (required) invalid(`${label} is required.`);
    return "";
  }
  if (typeof value !== "string") invalid(`${label} must be text.`);
  const normalized = value.trim();
  if (!normalized && required) invalid(`${label} is required.`);
  if (normalized.length > maxLength) invalid(`${label} is too long.`);
  if (CONTROL_CHARACTERS.test(normalized)) invalid(`${label} contains invalid characters.`);
  return normalized;
}

function firstText(
  record: Record<string, unknown>,
  keys: readonly string[],
  label: string,
  maxLength: number
) {
  const key = keys.find((candidate) => record[candidate] !== undefined && record[candidate] !== null);
  return key ? boundedString(record[key], label, maxLength) : "";
}

function safeVenueUrl(value: unknown, label: string, venue: VenueDefinition) {
  const raw = boundedString(value, label, 2048);
  if (!raw) return "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return invalid(`${label} is not a valid URL.`);
  }
  if (parsed.protocol !== "https:") invalid(`${label} must use HTTPS.`);
  if (!venue.allowedHosts.includes(parsed.hostname.toLowerCase())) {
    invalid(`${label} does not belong to ${venue.name}.`);
  }
  parsed.username = "";
  parsed.password = "";
  return parsed.toString();
}

function sanitizeInterval(value: unknown, label: string): AvailabilityInterval {
  if (!isRecord(value)) invalid(`${label} must be an object.`);
  const start = firstText(value, ["start_time", "startTime"], `${label}.start_time`, 32);
  const end = firstText(value, ["end_time", "endTime"], `${label}.end_time`, 32);
  if (!start || !end) invalid(`${label} must include start and end times.`);
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) invalid(`${label} must use valid clock times.`);
  if (startMinutes >= 24 * 60) invalid(`${label}.start_time must be before 24:00.`);
  const isOvernight = startMinutes >= 18 * 60 && endMinutes <= 6 * 60;
  if (endMinutes <= startMinutes && !isOvernight) invalid(`${label} must end after it starts.`);
  return { start_time: start, end_time: end };
}

function sanitizeIntervals(value: unknown, label: string) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) invalid(`${label} must be an array.`);
  if (value.length > MAX_INTERVALS) invalid(`${label} has too many intervals.`);
  return value.map((interval, index) => sanitizeInterval(interval, `${label}[${index}]`));
}

function sanitizeCourtGroup(value: unknown, label: string): AvailabilityCourtIntervals | null {
  if (!isRecord(value)) invalid(`${label} must be an object.`);
  const courtName = firstText(value, ["court_name", "courtName"], `${label}.court_name`, 160);
  const resourceName = firstText(value, ["resource_name"], `${label}.resource_name`, 160);
  const providerName = firstText(value, ["provider_name"], `${label}.provider_name`, 160);
  if (!courtName && !resourceName && !providerName) invalid(`${label} requires a court or resource name.`);

  const intervals = sanitizeIntervals(value.intervals, `${label}.intervals`);
  if (!intervals.length) return null;
  const levelName = firstText(value, ["level_name", "levelName"], `${label}.level_name`, 120);
  const price = firstText(value, ["price"], `${label}.price`, 64);
  return {
    ...(courtName ? { court_name: courtName } : {}),
    ...(resourceName ? { resource_name: resourceName } : {}),
    ...(providerName ? { provider_name: providerName } : {}),
    ...(levelName ? { level_name: levelName } : {}),
    ...(price ? { price } : {}),
    intervals,
  };
}

function sanitizeCourtGroups(value: unknown, label: string) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) invalid(`${label} must be an array.`);
  if (value.length > MAX_GROUPS) invalid(`${label} has too many groups.`);
  return value
    .map((group, index) => sanitizeCourtGroup(group, `${label}[${index}]`))
    .filter((group): group is AvailabilityCourtIntervals => Boolean(group));
}

function sanitizeLevelGroup(value: unknown, label: string): AvailabilityLevelIntervals | null {
  if (!isRecord(value)) invalid(`${label} must be an object.`);
  const levelName = firstText(
    value,
    ["level_name", "levelName", "title", "service_name"],
    `${label}.level_name`,
    120
  );
  if (!levelName) invalid(`${label} requires a level name.`);
  const intervals = sanitizeIntervals(value.intervals, `${label}.intervals`);
  if (!intervals.length) return null;
  const price = firstText(value, ["price"], `${label}.price`, 64);
  return { level_name: levelName, ...(price ? { price } : {}), intervals };
}

function sanitizeLevelGroups(value: unknown, label: string) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) invalid(`${label} must be an array.`);
  if (value.length > MAX_GROUPS) invalid(`${label} has too many groups.`);
  return value
    .map((group, index) => sanitizeLevelGroup(group, `${label}[${index}]`))
    .filter((group): group is AvailabilityLevelIntervals => Boolean(group));
}

function sanitizeRemainingHours(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 48) {
    invalid(`${label} must be a number between 0 and 48.`);
  }
  return Math.round(value * 100) / 100;
}

function sanitizeDay(value: unknown, index: number, venue: VenueDefinition): AvailabilityPayloadDay {
  const label = `days[${index}]`;
  if (!isRecord(value)) invalid(`${label} must be an object.`);
  const date = boundedString(value.date, `${label}.date`, 128, { required: true });
  const title = boundedString(value.title, `${label}.title`, 200);
  const bookingDate = boundedString(value.booking_date, `${label}.booking_date`, 128);
  const continuityStatus = boundedString(value.continuity_status, `${label}.continuity_status`, 32);
  const allowedContinuity = ["available", "partial", "failed", "not_scanned", "not_exposed", "unavailable"];
  if (continuityStatus && !allowedContinuity.includes(continuityStatus)) {
    invalid(`${label}.continuity_status is unsupported.`);
  }

  const sourceUrl = safeVenueUrl(value.source_url, `${label}.source_url`, venue);
  const bookingUrl = safeVenueUrl(value.booking_url, `${label}.booking_url`, venue);
  const actionUrl = safeVenueUrl(
    value.booking_action_url ?? value.bookingActionUrl,
    `${label}.booking_action_url`,
    venue
  );
  const remainingHours = sanitizeRemainingHours(value.remaining_hours, `${label}.remaining_hours`);

  return {
    date,
    ...(title ? { title } : {}),
    ...(bookingDate ? { booking_date: bookingDate } : {}),
    ...(sourceUrl ? { source_url: sourceUrl } : {}),
    ...(bookingUrl ? { booking_url: bookingUrl } : {}),
    ...(actionUrl ? { booking_action_url: actionUrl } : {}),
    open_intervals: sanitizeIntervals(value.open_intervals, `${label}.open_intervals`),
    same_court_intervals: sanitizeCourtGroups(value.same_court_intervals, `${label}.same_court_intervals`),
    level_intervals: sanitizeLevelGroups(value.level_intervals, `${label}.level_intervals`),
    ...(continuityStatus ? { continuity_status: continuityStatus } : {}),
    ...(remainingHours !== undefined ? { remaining_hours: remainingHours } : {}),
  };
}

export function sanitizeAvailabilityPayload(
  value: unknown,
  venueId: string,
  { now = Date.now() }: { now?: number } = {}
): AvailabilityPayload {
  const venue = getVenueDefinition(venueId);
  if (!venue) invalid("venue is unsupported.");
  if (!isRecord(value)) invalid("body must be an object.");

  const payloadVenueId = boundedString(value.venue_id, "venue_id", 100, { required: true }).toLowerCase();
  if (payloadVenueId !== venue.id) invalid("venue_id does not match the request URL.");
  const exportedAt = boundedString(value.exported_at, "exported_at", 64, { required: true });
  const exportedTime = Date.parse(exportedAt);
  if (!Number.isFinite(exportedTime)) invalid("exported_at must be a valid timestamp.");
  if (exportedTime > now + MAX_FUTURE_EXPORT_MS) invalid("exported_at is too far in the future.");
  if (!Array.isArray(value.days)) invalid("days must be an array.");
  if (value.days.length > MAX_DAYS) invalid("days has too many entries.");

  const sourceUrl = safeVenueUrl(value.source_url, "source_url", venue);
  const bookingUrl = safeVenueUrl(value.booking_url, "booking_url", venue);
  return {
    venue_id: venue.id,
    venue_name: venue.name,
    exported_at: new Date(exportedTime).toISOString(),
    ...(sourceUrl ? { source_url: sourceUrl } : {}),
    ...(bookingUrl ? { booking_url: bookingUrl } : {}),
    days: value.days.map((day, index) => sanitizeDay(day, index, venue)),
  };
}

export async function readAvailabilityPayload(request: Request, venueId: string) {
  const declaredLength = Number(request.headers.get("content-length") || "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    invalid("body is too large.");
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    invalid("body is too large.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    invalid("body must be valid JSON.");
  }
  return sanitizeAvailabilityPayload(parsed, venueId);
}
