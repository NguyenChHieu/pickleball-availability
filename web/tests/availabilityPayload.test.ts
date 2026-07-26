import assert from "node:assert/strict";
import test from "node:test";

import {
  InvalidAvailabilityPayloadError,
  readAvailabilityPayload,
  sanitizeAvailabilityPayload,
} from "../src/server/availabilityPayload.ts";

const NOW = Date.parse("2026-07-26T10:00:00.000Z");

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    venue_id: "propickle",
    venue_name: "Untrusted venue name",
    exported_at: "2026-07-26T09:59:00.000Z",
    source_url: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true",
    booking_url: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true",
    raw_secret: "drop me",
    days: [
      {
        date: "Sunday, July 26",
        title: "Any pickleball court",
        booking_date: "2026-07-26",
        booking_url: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true",
        open_intervals: [
          { start_time: "6:00 PM", end_time: "7:30 PM", internal: "drop me" },
        ],
        same_court_intervals: [
          {
            court_name: "Court 4",
            intervals: [{ start_time: "6:00 PM", end_time: "7:00 PM" }],
            raw_provider_id: "drop me",
          },
        ],
        continuity_status: "available",
        remaining_hours: 1.5,
        raw_slots: [{ player_name: "must not persist" }],
        probe_debug: [{ detail: "must not persist" }],
      },
    ],
    ...overrides,
  };
}

test("sync payloads are canonicalized and debugging fields are removed", () => {
  const payload = sanitizeAvailabilityPayload(validPayload(), "propickle", { now: NOW });
  const serialized = JSON.stringify(payload);

  assert.equal(payload.venue_id, "propickle");
  assert.equal(payload.venue_name, "ProPickle");
  assert.equal(payload.exported_at, "2026-07-26T09:59:00.000Z");
  assert.deepEqual(payload.days?.[0].open_intervals, [
    { start_time: "6:00 PM", end_time: "7:30 PM" },
  ]);
  assert.deepEqual(payload.days?.[0].same_court_intervals, [
    {
      court_name: "Court 4",
      intervals: [{ start_time: "6:00 PM", end_time: "7:00 PM" }],
    },
  ]);
  assert.doesNotMatch(serialized, /raw_slots|probe_debug|raw_secret|raw_provider_id|player_name/);
});

test("sync payloads reject mismatched venues and off-venue links", () => {
  assert.throws(
    () => sanitizeAvailabilityPayload(validPayload({ venue_id: "broadway" }), "propickle", { now: NOW }),
    InvalidAvailabilityPayloadError
  );
  assert.throws(
    () =>
      sanitizeAvailabilityPayload(
        validPayload({ booking_url: "https://example.com/fake-booking" }),
        "propickle",
        { now: NOW }
      ),
    /does not belong to ProPickle/i
  );
});

test("sync payloads reject future timestamps and unreasonable collection sizes", () => {
  assert.throws(
    () =>
      sanitizeAvailabilityPayload(
        validPayload({ exported_at: "2026-07-26T10:05:01.000Z" }),
        "propickle",
        { now: NOW }
      ),
    /future/i
  );
  assert.throws(
    () => sanitizeAvailabilityPayload(validPayload({ days: Array(32).fill({ date: "x" }) }), "propickle", { now: NOW }),
    /too many/i
  );
});

test("every configured provider host passes the server trust boundary", () => {
  const cases = [
    ["propickle", "https://book.propickle.com.au/book/ProPickle?skip_waivers=true"],
    ["broadway", "https://clubspark.au/Broadway/Booking/BookByDate#?role=guest"],
    ["northryde", "https://go.mindbodyonline.com/book/widgets/appointments/view/example/services"],
    ["sydneyracquet", "https://playtomic.com/clubs/sydney-racquet-club?sport_id=PICKLEBALL"],
    [
      "houseofpickle-darlingharbour",
      "https://houseofpickle.podplay.app/book/darling-harbour?pod=darling-harbour-pickleball-courts",
    ],
    ["wotso-pyrmont", "https://wotso.hamletapp.co/shop/experience/pyrmont"],
  ] as const;

  for (const [venueId, sourceUrl] of cases) {
    const payload = sanitizeAvailabilityPayload(
      {
        venue_id: venueId,
        exported_at: "2026-07-26T09:59:00.000Z",
        source_url: sourceUrl,
        days: [],
      },
      venueId,
      { now: NOW }
    );
    assert.equal(payload.venue_id, venueId);
    assert.equal(new URL(payload.source_url || "").hostname, new URL(sourceUrl).hostname);
  }
});

test("sync request bodies are bounded before parsing and persistence", async () => {
  const request = new Request("https://example.test/api/availability/propickle", {
    method: "POST",
    body: JSON.stringify({ padding: "x".repeat(4 * 1024 * 1024) }),
  });

  await assert.rejects(() => readAvailabilityPayload(request, "propickle"), /too large/i);
});
