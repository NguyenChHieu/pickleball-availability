const test = require("node:test");
const assert = require("node:assert/strict");

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
