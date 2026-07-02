const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const { bookingActionUrlForDay, bookingUrlForDay, stripHash } = require("../src/bookingLinks");
const { buildPublicAvailabilityResponse, STALE_THRESHOLD_HOURS } = require("../src/publicAvailability");

const READY_RECORD = {
  received_at: "2026-07-02T00:00:00.000Z",
  venue_id: "propickle",
  payload: {
    venue_name: "ProPickle",
    exported_at: "2026-07-02T01:00:00.000Z",
    booking_url: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true#old",
    source_url: "https://book.propickle.com.au/book/ProPickle",
    days: [
      {
        date: "Tue 30 Jun",
        title: "Court booking",
        booking_date: "Tue 30 Jun",
        remaining_hours: 2.5,
        open_intervals: [
          { start_time: "10:00", end_time: "11:30" },
          { start_time: "14:00", end_time: "15:00" },
        ],
      },
      {
        date: "Wed 01 Jul",
        title: "Court booking",
        remaining_hours: 1,
        open_intervals: [{ start_time: "08:00", end_time: "09:00" }],
      },
    ],
  },
};

const SERVER_MODULES = ["../src/index", "../src/availabilityStore"];
const SERVER_ENV_KEYS = [
  "AVAILABILITY_DATA_DIR",
  "AVAILABILITY_SYNC_TOKEN",
  "RENDER",
  "SHARE_TOKEN",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
];

function clearServerModules() {
  for (const modulePath of SERVER_MODULES) {
    delete require.cache[require.resolve(modulePath)];
  }
}

function restoreEnv(previousEnv) {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function startPublicServer(t) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pbb-public-"));
  const previousEnv = Object.fromEntries(SERVER_ENV_KEYS.map((key) => [key, process.env[key]]));

  process.env.AVAILABILITY_DATA_DIR = tempDir;
  process.env.AVAILABILITY_SYNC_TOKEN = "test-sync-token";
  process.env.SHARE_TOKEN = "dev-share";
  delete process.env.RENDER;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;

  clearServerModules();
  const { handleRequest } = require("../src/index");
  const { saveAvailability } = require("../src/availabilityStore");
  const server = http.createServer(handleRequest);

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(tempDir, { force: true, recursive: true });
    restoreEnv(previousEnv);
    clearServerModules();
  });

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    saveAvailability,
  };
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  return {
    body: await response.json(),
    headers: response.headers,
    status: response.status,
  };
}

test("ready cache returns display-ready allowlisted ProPickle availability", () => {
  const result = buildPublicAvailabilityResponse(READY_RECORD, {
    venueId: "propickle",
    now: "2026-07-02T02:00:00.000Z",
  });

  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(result.body).sort(), [
    "days",
    "fallbackUrl",
    "freshnessLabel",
    "isStale",
    "lastReadAt",
    "staleThresholdHours",
    "state",
    "summary",
    "themeId",
    "venueId",
    "venueName",
  ]);
  assert.equal(result.body.state, "ready");
  assert.equal(result.body.venueId, "propickle");
  assert.equal(result.body.venueName, "ProPickle");
  assert.equal(result.body.themeId, "propickle");
  assert.equal(result.body.lastReadAt, "2026-07-02T01:00:00.000Z");
  assert.ok(result.body.freshnessLabel);
  assert.equal(result.body.isStale, false);
  assert.equal(result.body.staleThresholdHours, 12);
  assert.deepEqual(result.body.summary, { dayCount: 2, totalOpenHours: 3.5 });

  assert.deepEqual(Object.keys(result.body.days[0]).sort(), [
    "bookingUrl",
    "date",
    "openIntervals",
    "title",
    "totalOpenHours",
  ]);
  assert.equal(result.body.days[0].date, "Tue 30 Jun");
  assert.equal(result.body.days[0].totalOpenHours, 2.5);
  assert.equal(
    result.body.days[0].bookingUrl,
    "https://book.propickle.com.au/book/ProPickle?skip_waivers=true#pbb_date=Tue%2030%20Jun"
  );
  assert.deepEqual(result.body.days[0].openIntervals[0], {
    startTime: "10:00",
    endTime: "11:30",
    label: "10:00-11:30",
  });

  const serialized = JSON.stringify(result.body);
  assert.doesNotMatch(serialized, /payload|received_at|venue_id|SUPABASE|AVAILABILITY_SYNC_TOKEN|x-sync-token/i);
});

test("stale cache uses the locked 12 hour threshold", () => {
  const result = buildPublicAvailabilityResponse(READY_RECORD, {
    venueId: "propickle",
    now: "2026-07-02T14:00:01.000Z",
  });

  assert.equal(STALE_THRESHOLD_HOURS, 12);
  assert.equal(result.status, 200);
  assert.equal(result.body.state, "ready");
  assert.equal(result.body.isStale, true);
});

test("empty cache returns a display-safe empty state", () => {
  const result = buildPublicAvailabilityResponse(null, {
    venueId: "propickle",
    now: "2026-07-02T02:00:00.000Z",
  });

  assert.equal(result.status, 404);
  assert.deepEqual(result.body, {
    state: "empty",
    message: "No cached availability yet.",
    fallbackUrl: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true",
  });
});

test("safe booking links strip existing hashes and reject unsafe protocols", () => {
  const day = {
    date: "Tue 30 Jun",
    booking_date: "Tue 30 Jun",
    source_url: "https://book.propickle.com.au/book/ProPickle#ignored",
  };

  assert.equal(stripHash("javascript:alert(1)"), "");
  assert.equal(stripHash("data:text/html,hello"), "");
  assert.equal(stripHash("not a url"), "");
  assert.equal(stripHash("https://book.propickle.com.au/book/ProPickle#ignored"), "https://book.propickle.com.au/book/ProPickle");
  assert.equal(bookingUrlForDay(day, {}), "https://book.propickle.com.au/book/ProPickle");
  assert.equal(
    bookingActionUrlForDay(day, {}),
    "https://book.propickle.com.au/book/ProPickle#pbb_date=Tue%2030%20Jun"
  );
  assert.equal(bookingActionUrlForDay({ source_url: "javascript:alert(1)" }, {}), "");
});

test("public endpoint validates token and returns display-safe cache states", async (t) => {
  const { baseUrl, saveAvailability } = await startPublicServer(t);

  const wrongToken = await getJson(`${baseUrl}/api/public/wrong/propickle`);
  assert.equal(wrongToken.status, 404);
  assert.deepEqual(wrongToken.body, { error: "Not found" });

  const empty = await getJson(`${baseUrl}/api/public/dev-share/propickle`);
  assert.equal(empty.status, 404);
  assert.equal(empty.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual(empty.body, {
    state: "empty",
    message: "No cached availability yet.",
    fallbackUrl: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true",
  });

  await saveAvailability("propickle", READY_RECORD.payload);

  const ready = await getJson(`${baseUrl}/api/public/dev-share/propickle`);
  assert.equal(ready.status, 200);
  assert.equal(ready.headers.get("access-control-allow-origin"), "*");
  assert.equal(ready.body.state, "ready");
  assert.equal(ready.body.venueId, "propickle");
  assert.equal(ready.body.days.length, 2);
  assert.equal(
    ready.body.days[0].bookingUrl,
    "https://book.propickle.com.au/book/ProPickle?skip_waivers=true#pbb_date=Tue%2030%20Jun"
  );
  assert.doesNotMatch(JSON.stringify(ready.body), /payload|received_at|venue_id|SUPABASE|AVAILABILITY_SYNC_TOKEN|x-sync-token/i);

  const preflight = await fetch(`${baseUrl}/api/public/dev-share/propickle`, { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
});
