import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getVenueDefinition, venues } from "../lib/venues.ts";
import {
  getAvailabilityRecord,
  type AvailabilityPayload,
  type AvailabilityPayloadDay,
  type AvailabilityRecord,
} from "./availabilityStore.ts";
import { bookingUrlForDay } from "./bookingLinks.ts";
import { formatDateTime } from "./formatAvailability.ts";
import { buildPlannerGroupTimes, buildPlannerRecommendations, mergeBlocks, parseTimeToMinutes } from "./plannerMatch.ts";
import type {
  PlannerAvailabilityBlock,
  PlannerEvent,
  PlannerParticipant,
  PlannerVenueAvailability,
  PlannerVenueInterval,
  PublicPlannerEventView,
} from "./plannerTypes.ts";

type PlannerFileRecord = {
  event: PlannerEvent;
  participants: PlannerParticipant[];
};

type PlannerEventInput = {
  name: string;
  dateStart: string;
  dateEnd: string;
  preferredStartTime: string;
  preferredEndTime: string;
  minimumDurationMinutes: number;
  venueIds: string[];
};

type ParticipantInput = {
  displayName: string;
  editToken?: string;
  editPassword?: string;
  availabilityBlocks: PlannerAvailabilityBlock[];
};

const scryptAsync = promisify(scryptCallback);
const DATA_DIR = process.env.PLANNER_DATA_DIR
  ? path.resolve(process.env.PLANNER_DATA_DIR)
  : path.resolve(process.cwd(), "data", "planner");
const SUPABASE_URL = trimTrailingSlash(process.env.SUPABASE_URL || "");
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USE_SUPABASE = Boolean(SUPABASE_URL || SUPABASE_SECRET_KEY);
const STALE_THRESHOLD_MINUTES = 5;
const STALE_THRESHOLD_MS = STALE_THRESHOLD_MINUTES * 60 * 1000;
const MAX_PLANNER_DAYS = 14;
const EDIT_PASSWORD_PREFIX = "scrypt-v1";
const MIN_EDIT_PASSWORD_LENGTH = 4;

if (USE_SUPABASE && (!SUPABASE_URL || !SUPABASE_SECRET_KEY)) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY, or neither.");
}

function trimTrailingSlash(value: string) {
  return String(value || "").replace(/\/+$/, "");
}

function assertWritableLocalPlannerStore() {
  if (process.env.VERCEL) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required for deployed planner storage.");
  }
}

function plannerPath(eventToken: string) {
  return path.join(DATA_DIR, `${safeToken(eventToken)}.json`);
}

function safeToken(token: unknown) {
  const normalized = String(token || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!normalized) throw new Error("Missing planner token.");
  return normalized;
}

function randomToken(byteLength = 18) {
  return randomBytes(byteLength).toString("base64url");
}

export function normalizeDisplayNameKey(displayName: string) {
  return String(displayName || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeEditPassword(value: unknown) {
  const password = String(value || "").trim();
  if (password && password.length < MIN_EDIT_PASSWORD_LENGTH) {
    throw new Error(`Edit password must be at least ${MIN_EDIT_PASSWORD_LENGTH} characters.`);
  }
  return password;
}

async function hashEditPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scryptAsync(password, salt, 32)) as Buffer;
  return `${EDIT_PASSWORD_PREFIX}:${salt}:${derivedKey.toString("base64url")}`;
}

async function verifyEditPassword(password: string, storedHash: string | undefined) {
  if (!password || !storedHash) return false;
  const [prefix, salt, hashText] = storedHash.split(":");
  if (prefix !== EDIT_PASSWORD_PREFIX || !salt || !hashText) return false;

  const expected = Buffer.from(hashText, "base64url");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function supabaseEndpoint(table: string, search = "") {
  return `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}${search}`;
}

function supabaseHeaders(extra: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    apikey: SUPABASE_SECRET_KEY,
    ...extra,
  };
  if (!SUPABASE_SECRET_KEY.startsWith("sb_secret_")) {
    headers.authorization = `Bearer ${SUPABASE_SECRET_KEY}`;
  }
  return headers;
}

async function readSupabaseJson(response: Response) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase planner request failed: ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function isMissingPlannerPasswordColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("display_name_key") || message.includes("edit_password_hash");
}

function plannerPasswordMigrationError() {
  return new Error("Planner edit passwords need the latest Supabase migration. Run web/supabase.sql in Supabase, then retry.");
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function daysBetweenInclusive(dateStart: string, dateEnd: string) {
  const start = new Date(`${dateStart}T00:00:00`).getTime();
  const end = new Date(`${dateEnd}T00:00:00`).getTime();
  return Math.floor((end - start) / 86_400_000) + 1;
}

function normalizeEventInput(input: Partial<PlannerEventInput>): PlannerEventInput {
  const name = String(input.name || "").trim().slice(0, 80) || "Pickleball session";
  const dateStart = String(input.dateStart || "");
  const dateEnd = String(input.dateEnd || "");
  const preferredStartTime = String(input.preferredStartTime || "18:00");
  const preferredEndTime = String(input.preferredEndTime || "23:00");
  const minimumDurationMinutes = Number(input.minimumDurationMinutes || 60);
  const venueIds = Array.isArray(input.venueIds)
    ? input.venueIds.filter((venueId) => venues.some((venue) => venue.id === venueId))
    : [];

  if (!isIsoDate(dateStart) || !isIsoDate(dateEnd) || dateStart > dateEnd) {
    throw new Error("Choose a valid planner date range.");
  }
  if (daysBetweenInclusive(dateStart, dateEnd) > MAX_PLANNER_DAYS) {
    throw new Error(`Planner events can cover up to ${MAX_PLANNER_DAYS} days.`);
  }
  if ((parseTimeToMinutes(preferredStartTime) ?? -1) >= (parseTimeToMinutes(preferredEndTime) ?? -1)) {
    throw new Error("Preferred end time must be after preferred start time.");
  }
  if (!Number.isInteger(minimumDurationMinutes) || minimumDurationMinutes < 30 || minimumDurationMinutes > 240) {
    throw new Error("Minimum duration must be between 30 and 240 minutes.");
  }
  if (!venueIds.length) throw new Error("Choose at least one venue.");

  return {
    name,
    dateStart,
    dateEnd,
    preferredStartTime,
    preferredEndTime,
    minimumDurationMinutes,
    venueIds,
  };
}

function normalizeBlocks(blocks: unknown): PlannerAvailabilityBlock[] {
  if (!Array.isArray(blocks)) return [];
  return mergeBlocks(
    blocks
      .map((block) => {
        const record = block as Record<string, unknown>;
        return {
          date: String(record.date || ""),
          startMinute: Number(record.startMinute),
          endMinute: Number(record.endMinute),
        };
      })
      .filter(
        (block) =>
          isIsoDate(block.date) &&
          Number.isInteger(block.startMinute) &&
          Number.isInteger(block.endMinute) &&
          block.startMinute >= 0 &&
          block.endMinute <= 24 * 60 &&
          block.endMinute > block.startMinute
      )
  );
}

function publicParticipants(participants: PlannerParticipant[]) {
  return participants.map((participant) => ({
    participantId: participant.participantId,
    displayName: participant.displayName,
    availabilityBlocks: participant.availabilityBlocks,
    createdAt: participant.createdAt,
  }));
}

function normalizeParticipantRecord(participant: PlannerParticipant, eventToken: string): PlannerParticipant {
  return {
    ...participant,
    eventToken: participant.eventToken || eventToken,
    displayNameKey: participant.displayNameKey || normalizeDisplayNameKey(participant.displayName),
    editPasswordHash: participant.editPasswordHash || undefined,
    availabilityBlocks: mergeBlocks(participant.availabilityBlocks || []),
  };
}

function normalizePlannerRecord(record: PlannerFileRecord): PlannerFileRecord {
  return {
    event: record.event,
    participants: (record.participants || []).map((participant) =>
      normalizeParticipantRecord(participant, record.event.eventToken)
    ),
  };
}

async function ensurePlannerDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readLocalPlannerFile(eventToken: string) {
  assertWritableLocalPlannerStore();
  try {
    return normalizePlannerRecord(JSON.parse(await fs.readFile(plannerPath(eventToken), "utf8")) as PlannerFileRecord);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeLocalPlannerFile(record: PlannerFileRecord) {
  assertWritableLocalPlannerStore();
  await ensurePlannerDir();
  await fs.writeFile(plannerPath(record.event.eventToken), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

export async function createPlannerEvent(input: Partial<PlannerEventInput>) {
  const normalized = normalizeEventInput(input);
  const event: PlannerEvent = {
    ...normalized,
    eventToken: randomToken(),
    createdAt: new Date().toISOString(),
  };

  if (USE_SUPABASE) return createPlannerEventSupabase(event);

  await writeLocalPlannerFile({ event, participants: [] });
  return event;
}

async function createPlannerEventSupabase(event: PlannerEvent) {
  await readSupabaseJson(
    await fetch(supabaseEndpoint("planner_events"), {
      method: "POST",
      headers: supabaseHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        event_token: event.eventToken,
        name: event.name,
        date_start: event.dateStart,
        date_end: event.dateEnd,
        preferred_start_time: event.preferredStartTime,
        preferred_end_time: event.preferredEndTime,
        minimum_duration_minutes: event.minimumDurationMinutes,
        created_at: event.createdAt,
      }),
    })
  );

  await readSupabaseJson(
    await fetch(supabaseEndpoint("planner_event_venues"), {
      method: "POST",
      headers: supabaseHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(event.venueIds.map((venueId) => ({ event_token: event.eventToken, venue_id: venueId }))),
    })
  );

  return event;
}

export async function getPlannerEventView(eventToken: string): Promise<PublicPlannerEventView | null> {
  const record = USE_SUPABASE ? await readPlannerEventSupabase(eventToken) : await readLocalPlannerFile(eventToken);
  if (!record) return null;

  const venueRecords = await Promise.all(record.event.venueIds.map((venueId) => getAvailabilityRecord(venueId)));
  const plannerVenues = record.event.venueIds.map((venueId, index) =>
    venueAvailabilityForPlanner(venueId, venueRecords[index])
  );

  return {
    event: record.event,
    participants: publicParticipants(record.participants),
    venues: plannerVenues,
    groupTimes: buildPlannerGroupTimes(record.event, record.participants).slice(0, 24),
    recommendations: buildPlannerRecommendations(record.event, record.participants, plannerVenues).slice(0, 24),
  };
}

async function readPlannerEventSupabase(eventToken: string): Promise<PlannerFileRecord | null> {
  const token = encodeURIComponent(safeToken(eventToken));
  const eventRows = await readSupabaseJson(
    await fetch(
      supabaseEndpoint(
        "planner_events",
        `?event_token=eq.${token}&select=event_token,name,date_start,date_end,preferred_start_time,preferred_end_time,minimum_duration_minutes,created_at&limit=1`
      ),
      { headers: supabaseHeaders() }
    )
  );
  const eventRow = eventRows?.[0];
  if (!eventRow) return null;

  const venueRows = await readSupabaseJson(
    await fetch(supabaseEndpoint("planner_event_venues", `?event_token=eq.${token}&select=venue_id`), {
      headers: supabaseHeaders(),
    })
  );
  const participantRows = await readSupabaseParticipants(token);
  const blockRows = await readSupabaseJson(
    await fetch(
      supabaseEndpoint(
        "planner_availability_blocks",
        `?event_token=eq.${token}&select=participant_id,date,start_minute,end_minute`
      ),
      { headers: supabaseHeaders() }
    )
  );

  const event: PlannerEvent = {
    eventToken: eventRow.event_token,
    name: eventRow.name,
    dateStart: eventRow.date_start,
    dateEnd: eventRow.date_end,
    preferredStartTime: eventRow.preferred_start_time,
    preferredEndTime: eventRow.preferred_end_time,
    minimumDurationMinutes: Number(eventRow.minimum_duration_minutes || 60),
    venueIds: (venueRows || []).map((row: { venue_id: string }) => row.venue_id),
    createdAt: eventRow.created_at,
  };

  const blocksByParticipant = new Map<string, PlannerAvailabilityBlock[]>();
  for (const row of blockRows || []) {
    const blocks = blocksByParticipant.get(row.participant_id) || [];
    blocks.push({
      date: row.date,
      startMinute: Number(row.start_minute),
      endMinute: Number(row.end_minute),
    });
    blocksByParticipant.set(row.participant_id, blocks);
  }

  return {
    event,
    participants: (participantRows || []).map((row: Record<string, string>) => ({
      participantId: row.participant_id,
      eventToken: event.eventToken,
      displayName: row.display_name,
      displayNameKey: row.display_name_key || normalizeDisplayNameKey(row.display_name),
      editToken: row.edit_token,
      editPasswordHash: row.edit_password_hash || undefined,
      createdAt: row.created_at,
      availabilityBlocks: mergeBlocks(blocksByParticipant.get(row.participant_id) || []),
    })),
  };
}

async function readSupabaseParticipants(token: string) {
  try {
    return await readSupabaseJson(
      await fetch(
        supabaseEndpoint(
          "planner_participants",
          `?event_token=eq.${token}&select=participant_id,display_name,display_name_key,edit_token,edit_password_hash,created_at`
        ),
        { headers: supabaseHeaders() }
      )
    );
  } catch (error) {
    if (!isMissingPlannerPasswordColumns(error)) throw error;
    return readSupabaseJson(
      await fetch(
        supabaseEndpoint(
          "planner_participants",
          `?event_token=eq.${token}&select=participant_id,display_name,edit_token,created_at`
        ),
        { headers: supabaseHeaders() }
      )
    );
  }
}

export async function upsertPlannerParticipant(eventToken: string, input: Partial<ParticipantInput>) {
  const displayName = String(input.displayName || "").trim().slice(0, 60);
  if (!displayName) throw new Error("Enter a display name.");
  const displayNameKey = normalizeDisplayNameKey(displayName);
  if (!displayNameKey) throw new Error("Enter a display name.");
  const availabilityBlocks = normalizeBlocks(input.availabilityBlocks);
  const editToken = input.editToken ? safeToken(input.editToken) : "";
  const editPassword = normalizeEditPassword(input.editPassword);

  if (USE_SUPABASE) {
    try {
      return await upsertPlannerParticipantSupabase(eventToken, {
        displayName,
        displayNameKey,
        editToken,
        editPassword,
        availabilityBlocks,
      });
    } catch (error) {
      if (isMissingPlannerPasswordColumns(error)) throw plannerPasswordMigrationError();
      throw error;
    }
  }

  const record = await readLocalPlannerFile(eventToken);
  if (!record) return null;
  let participant = editToken
    ? record.participants.find((item) => item.editToken === editToken && item.eventToken === record.event.eventToken)
    : null;
  const participantByName = record.participants.find((item) => item.displayNameKey === displayNameKey) || null;

  if (!participant) {
    if (participantByName) {
      if (!(await verifyEditPassword(editPassword, participantByName.editPasswordHash))) {
        throw new Error("That name is already used for this event. Enter its edit password or choose another name.");
      }
      participant = participantByName;
    } else {
      if (!editPassword) throw new Error("Enter an edit password so you can update this availability later.");
      participant = {
        participantId: randomToken(12),
        eventToken: record.event.eventToken,
        displayName,
        displayNameKey,
        editToken: randomToken(18),
        availabilityBlocks,
        createdAt: new Date().toISOString(),
      };
      record.participants.push(participant);
    }
  } else if (participantByName && participantByName.participantId !== participant.participantId) {
    throw new Error("That name is already used for this event. Choose another name.");
  }

  if (editPassword) {
    participant.editPasswordHash = await hashEditPassword(editPassword);
  } else {
    participant.editPasswordHash = participant.editPasswordHash || undefined;
  }

  participant.displayName = displayName;
  participant.displayNameKey = displayNameKey;
  participant.availabilityBlocks = availabilityBlocks;

  await writeLocalPlannerFile(record);
  return participant;
}

async function upsertPlannerParticipantSupabase(
  eventToken: string,
  input: {
    displayName: string;
    displayNameKey: string;
    editToken?: string;
    editPassword?: string;
    availabilityBlocks: PlannerAvailabilityBlock[];
  }
) {
  const token = safeToken(eventToken);
  const event = await readPlannerEventSupabase(token);
  if (!event) return null;

  let participant: PlannerParticipant | undefined = input.editToken
    ? event.participants.find((item) => item.editToken === input.editToken)
    : undefined;
  const participantByName = event.participants.find((item) => item.displayNameKey === input.displayNameKey);
  let participantWasCreated = false;

  if (!participant) {
    if (participantByName) {
      if (!(await verifyEditPassword(input.editPassword || "", participantByName.editPasswordHash))) {
        throw new Error("That name is already used for this event. Enter its edit password or choose another name.");
      }
      participant = participantByName;
    } else {
      if (!input.editPassword) throw new Error("Enter an edit password so you can update this availability later.");
      const editPasswordHash = await hashEditPassword(input.editPassword);
      participant = {
        participantId: randomToken(12),
        eventToken: token,
        displayName: input.displayName,
        displayNameKey: input.displayNameKey,
        editToken: randomToken(18),
        editPasswordHash,
        availabilityBlocks: [],
        createdAt: new Date().toISOString(),
      };
      participantWasCreated = true;
      await readSupabaseJson(
        await fetch(supabaseEndpoint("planner_participants"), {
          method: "POST",
          headers: supabaseHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({
            participant_id: participant.participantId,
            event_token: participant.eventToken,
            display_name: participant.displayName,
            display_name_key: participant.displayNameKey,
            edit_token: participant.editToken,
            edit_password_hash: editPasswordHash,
            created_at: participant.createdAt,
          }),
        })
      );
    }
  } else if (participantByName && participantByName.participantId !== participant.participantId) {
    throw new Error("That name is already used for this event. Choose another name.");
  } else {
    participant.displayName = input.displayName;
    participant.displayNameKey = input.displayNameKey;
  }

  const patch: Record<string, string> = {
    display_name: input.displayName,
    display_name_key: input.displayNameKey,
  };
  if (input.editPassword) {
    patch.edit_password_hash = await hashEditPassword(input.editPassword);
  }

  if (!participantWasCreated && participant.participantId) {
    await readSupabaseJson(
      await fetch(supabaseEndpoint("planner_participants", `?participant_id=eq.${participant.participantId}`), {
        method: "PATCH",
        headers: supabaseHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(patch),
      })
    );
    participant.displayName = input.displayName;
    participant.displayNameKey = input.displayNameKey;
    if (patch.edit_password_hash) participant.editPasswordHash = patch.edit_password_hash;
  }

  await readSupabaseJson(
    await fetch(supabaseEndpoint("planner_availability_blocks", `?participant_id=eq.${participant.participantId}`), {
      method: "DELETE",
      headers: supabaseHeaders(),
    })
  );

  if (input.availabilityBlocks.length) {
    await readSupabaseJson(
      await fetch(supabaseEndpoint("planner_availability_blocks"), {
        method: "POST",
        headers: supabaseHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(
          input.availabilityBlocks.map((block) => ({
            event_token: token,
            participant_id: participant.participantId,
            date: block.date,
            start_minute: block.startMinute,
            end_minute: block.endMinute,
          }))
        ),
      })
    );
  }

  participant.availabilityBlocks = input.availabilityBlocks;
  return participant;
}

function venueAvailabilityForPlanner(venueId: string, record: AvailabilityRecord | null): PlannerVenueAvailability {
  const definition = getVenueDefinition(venueId);
  const payload = record?.payload || null;
  const venueName = payload?.venue_name || definition?.name || venueId;
  const fallbackUrl = payload ? bookingUrlForDay({}, payload as Record<string, unknown>) : definition?.fallbackUrl || "";
  const lastReadAt = payload?.exported_at || record?.received_at || null;

  if (!payload?.days?.length) {
    return {
      venueId,
      venueName,
      fallbackUrl,
      lastReadAt,
      freshnessLabel: formatDateTime(lastReadAt),
      isStale: false,
      staleThresholdMinutes: STALE_THRESHOLD_MINUTES,
      state: "empty",
      days: [],
    };
  }

  return {
    venueId,
    venueName,
    fallbackUrl,
    lastReadAt,
    freshnessLabel: formatDateTime(lastReadAt),
    isStale: isStaleTimestamp(lastReadAt),
    staleThresholdMinutes: STALE_THRESHOLD_MINUTES,
    state: "ready",
    days: payload.days
      .map((day) => normalizeVenueDay(day, payload))
      .filter((day) => day.date && day.intervals.length),
  };
}

function isStaleTimestamp(lastReadAt: string | null) {
  if (!lastReadAt) return false;
  const readTime = new Date(lastReadAt).getTime();
  if (!Number.isFinite(readTime)) return false;
  return Date.now() - readTime > STALE_THRESHOLD_MS;
}

function normalizeVenueDay(day: AvailabilityPayloadDay, payload: AvailabilityPayload) {
  const date = isoDateForDay(day);
  const sameCourtIntervals = Array.isArray(day.same_court_intervals) ? day.same_court_intervals : [];
  const sameCourt = sameCourtIntervals.flatMap((group) => {
    const courtName = group.court_name || group.courtName || group.resource_name || group.provider_name || "";
    const intervals = Array.isArray(group.intervals) ? group.intervals : [];
    return intervals
      .map((interval) => normalizeVenueInterval(interval, "same-court", courtName))
      .filter((interval): interval is PlannerVenueInterval => Boolean(interval));
  });

  const openIntervals = Array.isArray(day.open_intervals) ? day.open_intervals : [];
  const anyCourt = openIntervals
    .map((interval) => normalizeVenueInterval(interval, "any-court"))
    .filter((interval): interval is PlannerVenueInterval => Boolean(interval));

  return {
    date,
    intervals: sameCourt.length ? sameCourt : anyCourt,
    bookingUrl: bookingUrlForDay(day as Record<string, unknown>, payload as Record<string, unknown>),
  };
}

function isoDateForDay(day: AvailabilityPayloadDay) {
  const explicit = String(day.booking_date || "");
  if (isIsoDate(explicit)) return explicit;
  const date = String(day.date || "");
  if (isIsoDate(date)) return date;
  return "";
}

function normalizeVenueInterval(
  interval: Record<string, unknown>,
  confidence: PlannerVenueInterval["confidence"],
  courtName = ""
): PlannerVenueInterval | null {
  const startMinute = parseTimeToMinutes(interval.start_time || interval.startTime);
  const endMinute = parseTimeToMinutes(interval.end_time || interval.endTime);
  if (startMinute === null || endMinute === null || endMinute <= startMinute) return null;
  const normalized: PlannerVenueInterval = {
    startMinute,
    endMinute,
    confidence,
  };
  if (courtName) normalized.courtName = courtName;
  return normalized;
}
