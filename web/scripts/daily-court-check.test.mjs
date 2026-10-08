import assert from "node:assert/strict";
import test from "node:test";

import { readPlaytomicVenue, sydneyDate, validateRead } from "./daily-court-check.mjs";
import { AvailabilityRegistry } from "../../extension/venues.js";

test("scheduled Playtomic reads use the public pickleball API without loading club HTML", async () => {
  const venue = { ...AvailabilityRegistry.getVenue("sydneyracquet"), readDays: 2 };
  const requests = [];
  const payload = await readPlaytomicVenue(venue, async (url, options) => {
    requests.push(new URL(url));
    assert.equal(options.method, "GET");
    assert.ok(options.signal instanceof AbortSignal);
    return {
      ok: true,
      json: async () => [{
        resource_id: venue.resources[0].id,
        start_date: new URL(url).searchParams.get("date"),
        slots: [{ start_time: "08:00:00", duration: 60 }],
      }],
    };
  });
  assert.equal(requests.length, 2);
  for (const url of requests) {
    assert.equal(url.origin + url.pathname, "https://playtomic.com/api/clubs/availability");
    assert.equal(url.searchParams.get("sport_id"), "PICKLEBALL");
    assert.equal(url.searchParams.get("tenant_id"), venue.tenantId);
  }
  assert.equal(payload.source_url, venue.startUrl);
  assert.equal(payload.days[0].same_court_intervals[0].court_name, "Pickle 3");
  assert.equal(validateRead(payload, venue.id, sydneyDate()), 1);
});

test("scheduled Playtomic reads reject denial and malformed data", async () => {
  const venue = { ...AvailabilityRegistry.getVenue("sydneyracquet"), readDays: 1 };
  await assert.rejects(readPlaytomicVenue(venue, async () => ({ ok: false, status: 403 })), /403/);
  await assert.rejects(readPlaytomicVenue(venue, async () => ({ ok: true, json: async () => ({ error: "invalid" }) })), /invalid response/);
});

test("Sydney date follows daylight saving changes", () => {
  assert.equal(sydneyDate(new Date("2026-10-03T21:00:00Z")), "2026-10-04");
  assert.equal(sydneyDate(new Date("2027-04-03T20:00:00Z")), "2027-04-04");
});

test("accepts fully booked and shorter windows but rejects stale or incomplete reads", () => {
  const day = (date, intervals = [{ start_time: "09:00", end_time: "10:00" }]) => ({
    booking_date: date,
    open_intervals: intervals,
  });
  const today = "2026-10-02";
  const fullWeek = Array.from({ length: 7 }, (_unused, offset) =>
    day(`2026-10-${String(offset + 2).padStart(2, "0")}`)
  );
  assert.equal(validateRead({ venue_id: "broadway", days: fullWeek }, "broadway", today), 1);
  assert.equal(validateRead({ venue_id: "broadway", days: [day(today, [])] }, "broadway", today), 0);
  assert.equal(validateRead({ venue_id: "houseofpickle-darlingharbour", days: [day(today), day("2026-10-03")] }, "houseofpickle-darlingharbour", today, 2), 1);
  assert.throws(() => validateRead({ venue_id: "houseofpickle-darlingharbour", days: [day(today)] }, "houseofpickle-darlingharbour", today, 2), /too few days/);
  assert.throws(() => validateRead({ venue_id: "broadway", days: [day("2026-10-01")] }, "broadway", today), /wrong dates/);
  assert.throws(() => validateRead({ venue_id: "broadway", days: [day(today), day(today)] }, "broadway", today), /wrong dates/);
  assert.throws(() => validateRead({ venue_id: "broadway", days: [{ booking_date: today }] }, "broadway", today), /incomplete day/);
});
