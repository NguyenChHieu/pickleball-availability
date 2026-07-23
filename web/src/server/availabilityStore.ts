import fs from "node:fs/promises";
import path from "node:path";

import type { AvailabilityRefreshReport, AvailabilityRefreshState } from "./availabilityRefresh.ts";

export type AvailabilityInterval = {
  start_time?: string;
  end_time?: string;
  startTime?: string;
  endTime?: string;
};

export type AvailabilityCourtIntervals = {
  court_name?: string;
  courtName?: string;
  resource_name?: string;
  provider_name?: string;
  provider_id?: string;
  level_name?: string;
  price?: string;
  intervals?: AvailabilityInterval[];
};

export type AvailabilityLevelIntervals = {
  level_name?: string;
  levelName?: string;
  title?: string;
  service_name?: string;
  price?: string;
  intervals?: AvailabilityInterval[];
};

export type AvailabilityPayloadDay = {
  date?: string;
  title?: string;
  remaining_hours?: number;
  open_intervals?: AvailabilityInterval[];
  same_court_intervals?: AvailabilityCourtIntervals[];
  continuity_status?: string;
  level_intervals?: AvailabilityLevelIntervals[];
  booking_date?: string;
  booking_url?: string;
  booking_action_url?: string;
  source_url?: string;
};

export type AvailabilityPayload = {
  venue_id?: string;
  venue_name?: string;
  exported_at?: string;
  days?: AvailabilityPayloadDay[];
  booking_url?: string;
  source_url?: string;
};

export type AvailabilityRecord = {
  received_at: string;
  venue_id: string;
  payload: AvailabilityPayload;
};

const DATA_DIR = process.env.AVAILABILITY_DATA_DIR
  ? path.resolve(process.env.AVAILABILITY_DATA_DIR)
  : path.resolve(process.cwd(), "data");
const SUPABASE_URL = trimTrailingSlash(process.env.SUPABASE_URL || "");
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_TABLE = process.env.SUPABASE_AVAILABILITY_TABLE || "availability_cache";
const SUPABASE_REFRESH_STATE_TABLE =
  process.env.SUPABASE_REFRESH_STATE_TABLE || "availability_refresh_state";
const USE_SUPABASE = Boolean(SUPABASE_URL || SUPABASE_SECRET_KEY);

if (USE_SUPABASE && (!SUPABASE_URL || !SUPABASE_SECRET_KEY)) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY, or neither.");
}

function trimTrailingSlash(value: string) {
  return String(value || "").replace(/\/+$/, "");
}

function assertWritableLocalCache() {
  if (process.env.VERCEL) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required for deployed cache storage.");
  }
}

export function safeVenueId(venueId: unknown) {
  const normalized = String(venueId || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  if (!normalized) throw new Error("Missing venue id.");
  return normalized;
}

function venuePath(venueId: string) {
  return path.join(DATA_DIR, `${safeVenueId(venueId)}.json`);
}

function refreshStatePath(venueId: string) {
  return path.join(DATA_DIR, `${safeVenueId(venueId)}.refresh.json`);
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function saveAvailability(venueId: string, payload: AvailabilityPayload) {
  if (USE_SUPABASE) return saveAvailabilityToSupabase(venueId, payload);

  assertWritableLocalCache();
  await ensureDataDir();
  const record = {
    received_at: new Date().toISOString(),
    venue_id: safeVenueId(venueId),
    payload,
  } satisfies AvailabilityRecord;
  await fs.writeFile(venuePath(venueId), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

export async function getAvailabilityRecord(venueId: string) {
  if (USE_SUPABASE) return getAvailabilityRecordFromSupabase(venueId);

  assertWritableLocalCache();
  try {
    const raw = await fs.readFile(venuePath(venueId), "utf8");
    return JSON.parse(raw) as AvailabilityRecord;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function getAvailabilityPayload(venueId: string) {
  const record = await getAvailabilityRecord(venueId);
  return record?.payload || null;
}

export async function getAllPayloads() {
  const records = await getAllAvailabilityRecords();
  const payloads: Record<string, AvailabilityPayload | null> = {};
  for (const [venueId, record] of Object.entries(records)) payloads[venueId] = record?.payload || null;
  return payloads;
}

export async function getAllAvailabilityRecords() {
  if (USE_SUPABASE) return getAllAvailabilityRecordsFromSupabase();

  assertWritableLocalCache();
  await ensureDataDir();
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const records: Record<string, AvailabilityRecord | null> = {};
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name.endsWith(".refresh.json")) continue;
    const venueId = entry.name.slice(0, -5);
    records[venueId] = await getAvailabilityRecord(venueId);
  }
  return records;
}

export async function saveAvailabilityRefreshState(venueId: string, report: AvailabilityRefreshReport) {
  const state = {
    venue_id: safeVenueId(venueId),
    attempted_at: new Date().toISOString(),
    status: report.status,
    duration_ms: report.duration_ms,
    source: report.source,
  } satisfies AvailabilityRefreshState;

  if (USE_SUPABASE) return saveAvailabilityRefreshStateToSupabase(state);

  assertWritableLocalCache();
  await ensureDataDir();
  await fs.writeFile(refreshStatePath(venueId), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return { state, persisted: true };
}

export async function getAvailabilityRefreshState(venueId: string) {
  if (USE_SUPABASE) return getAvailabilityRefreshStateFromSupabase(venueId);

  assertWritableLocalCache();
  try {
    const raw = await fs.readFile(refreshStatePath(venueId), "utf8");
    return JSON.parse(raw) as AvailabilityRefreshState;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function getAllAvailabilityRefreshStates() {
  if (USE_SUPABASE) return getAllAvailabilityRefreshStatesFromSupabase();

  assertWritableLocalCache();
  await ensureDataDir();
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const states: Record<string, AvailabilityRefreshState | null> = {};
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".refresh.json")) continue;
    const venueId = entry.name.slice(0, -".refresh.json".length);
    states[venueId] = await getAvailabilityRefreshState(venueId);
  }
  return states;
}

function supabaseEndpoint(search = "") {
  return `${SUPABASE_URL}/rest/v1/${encodeURIComponent(SUPABASE_TABLE)}${search}`;
}

function supabaseRefreshStateEndpoint(search = "") {
  return `${SUPABASE_URL}/rest/v1/${encodeURIComponent(SUPABASE_REFRESH_STATE_TABLE)}${search}`;
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
    throw new Error(`Supabase cache request failed: ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function isMissingRefreshStateTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("PGRST205") ||
    message.includes("42P01") ||
    message.includes("schema cache")
  );
}

async function saveAvailabilityToSupabase(venueId: string, payload: AvailabilityPayload) {
  const record = {
    received_at: new Date().toISOString(),
    venue_id: safeVenueId(venueId),
    payload,
  } satisfies AvailabilityRecord;
  const response = await fetch(supabaseEndpoint("?on_conflict=venue_id"), {
    method: "POST",
    headers: supabaseHeaders({
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify(record),
  });
  const rows = await readSupabaseJson(response);
  return rows?.[0] || record;
}

async function getAvailabilityRecordFromSupabase(venueId: string) {
  const venue = encodeURIComponent(safeVenueId(venueId));
  const response = await fetch(
    supabaseEndpoint(`?venue_id=eq.${venue}&select=venue_id,received_at,payload&limit=1`),
    { headers: supabaseHeaders() }
  );
  const rows = await readSupabaseJson(response);
  return rows?.[0] || null;
}

async function getAllAvailabilityRecordsFromSupabase() {
  const response = await fetch(supabaseEndpoint("?select=venue_id,received_at,payload"), {
    headers: supabaseHeaders(),
  });
  const rows = await readSupabaseJson(response);
  const records: Record<string, AvailabilityRecord | null> = {};
  for (const row of rows || []) {
    records[row.venue_id] = row as AvailabilityRecord;
  }
  return records;
}

async function saveAvailabilityRefreshStateToSupabase(state: AvailabilityRefreshState) {
  try {
    const response = await fetch(`${supabaseRefreshStateEndpoint()}?on_conflict=venue_id`, {
      method: "POST",
      headers: supabaseHeaders({
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify(state),
    });
    const rows = await readSupabaseJson(response);
    return { state: (rows?.[0] || state) as AvailabilityRefreshState, persisted: true };
  } catch (error) {
    if (isMissingRefreshStateTable(error)) return { state, persisted: false };
    throw error;
  }
}

async function getAvailabilityRefreshStateFromSupabase(venueId: string) {
  const venue = encodeURIComponent(safeVenueId(venueId));
  try {
    const response = await fetch(
      supabaseRefreshStateEndpoint(
        `?venue_id=eq.${venue}&select=venue_id,attempted_at,status,duration_ms,source&limit=1`
      ),
      { headers: supabaseHeaders() }
    );
    const rows = await readSupabaseJson(response);
    return (rows?.[0] || null) as AvailabilityRefreshState | null;
  } catch (error) {
    if (isMissingRefreshStateTable(error)) return null;
    throw error;
  }
}

async function getAllAvailabilityRefreshStatesFromSupabase() {
  try {
    const response = await fetch(
      supabaseRefreshStateEndpoint("?select=venue_id,attempted_at,status,duration_ms,source"),
      { headers: supabaseHeaders() }
    );
    const rows = await readSupabaseJson(response);
    const states: Record<string, AvailabilityRefreshState | null> = {};
    for (const row of rows || []) states[row.venue_id] = row as AvailabilityRefreshState;
    return states;
  } catch (error) {
    if (isMissingRefreshStateTable(error)) return {};
    throw error;
  }
}
