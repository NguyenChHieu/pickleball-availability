const fs = require("node:fs/promises");
const path = require("node:path");

const DATA_DIR = path.resolve(__dirname, "..", "data");

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

module.exports = {
  getAllPayloads,
  getAvailabilityPayload,
  getAvailabilityRecord,
  saveAvailability,
};
