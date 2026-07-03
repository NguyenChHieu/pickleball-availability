import fs from "node:fs/promises";
import path from "node:path";

export type AvailabilityInterval = {
  start_time?: string;
  end_time?: string;
  startTime?: string;
  endTime?: string;
};

export type AvailabilityPayloadDay = {
  date?: string;
  title?: string;
  remaining_hours?: number;
  open_intervals?: AvailabilityInterval[];
  booking_date?: string;
  booking_url?: string;
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
const USE_SUPABASE = Boolean(SUPABASE_URL || SUPABASE_SECRET_KEY);

if (USE_SUPABASE && (!SUPABASE_URL || !SUPABASE_SECRET_KEY)) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY, or neither.");
}

if (!USE_SUPABASE && process.env.VERCEL) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required for deployed cache storage.");
}

function trimTrailingSlash(value: string) {
  return String(value || "").replace(/\/+$/, "");
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

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function saveAvailability(venueId: string, payload: AvailabilityPayload) {
  if (USE_SUPABASE) return saveAvailabilityToSupabase(venueId, payload);

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
  if (USE_SUPABASE) return getAllPayloadsFromSupabase();

  await ensureDataDir();
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const payloads: Record<string, AvailabilityPayload | null> = {};
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const venueId = entry.name.slice(0, -5);
    payloads[venueId] = await getAvailabilityPayload(venueId);
  }
  return payloads;
}

function supabaseEndpoint(search = "") {
  return `${SUPABASE_URL}/rest/v1/${encodeURIComponent(SUPABASE_TABLE)}${search}`;
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

async function getAllPayloadsFromSupabase() {
  const response = await fetch(supabaseEndpoint("?select=venue_id,payload"), {
    headers: supabaseHeaders(),
  });
  const rows = await readSupabaseJson(response);
  const payloads: Record<string, AvailabilityPayload | null> = {};
  for (const row of rows || []) {
    payloads[row.venue_id] = row.payload || null;
  }
  return payloads;
}
