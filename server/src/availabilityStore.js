const fs = require("node:fs/promises");
const path = require("node:path");

const DATA_DIR = process.env.AVAILABILITY_DATA_DIR
  ? path.resolve(process.env.AVAILABILITY_DATA_DIR)
  : path.resolve(__dirname, "..", "data");
const SUPABASE_URL = trimTrailingSlash(process.env.SUPABASE_URL || "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_TABLE = process.env.SUPABASE_AVAILABILITY_TABLE || "availability_cache";
const USE_SUPABASE = Boolean(SUPABASE_URL || SUPABASE_SERVICE_ROLE_KEY);

if (USE_SUPABASE && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error("Set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or neither.");
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function safeVenueId(venueId) {
  const normalized = String(venueId || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!normalized) throw new Error("Missing venue id.");
  return normalized;
}

function venuePath(venueId) {
  return path.join(DATA_DIR, `${safeVenueId(venueId)}.json`);
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function saveAvailability(venueId, payload) {
  if (USE_SUPABASE) return saveAvailabilityToSupabase(venueId, payload);

  await ensureDataDir();
  const record = {
    received_at: new Date().toISOString(),
    venue_id: safeVenueId(venueId),
    payload,
  };
  await fs.writeFile(venuePath(venueId), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

async function getAvailabilityRecord(venueId) {
  if (USE_SUPABASE) return getAvailabilityRecordFromSupabase(venueId);

  try {
    const raw = await fs.readFile(venuePath(venueId), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function getAvailabilityPayload(venueId) {
  const record = await getAvailabilityRecord(venueId);
  return record?.payload || null;
}

async function getAllPayloads() {
  if (USE_SUPABASE) return getAllPayloadsFromSupabase();

  await ensureDataDir();
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const payloads = {};
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

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

async function readSupabaseJson(response) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase cache request failed: ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function saveAvailabilityToSupabase(venueId, payload) {
  const record = {
    received_at: new Date().toISOString(),
    venue_id: safeVenueId(venueId),
    payload,
  };
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

async function getAvailabilityRecordFromSupabase(venueId) {
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
  const payloads = {};
  for (const row of rows || []) {
    payloads[row.venue_id] = row.payload || null;
  }
  return payloads;
}

module.exports = {
  getAllPayloads,
  getAvailabilityPayload,
  getAvailabilityRecord,
  saveAvailability,
};
