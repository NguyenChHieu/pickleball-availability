import assert from "node:assert/strict";
import test from "node:test";

import { sydneyDate, validateRead } from "./daily-court-check.mjs";

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
  assert.throws(() => validateRead({ venue_id: "broadway", days: [day("2026-10-01")] }, "broadway", today), /wrong dates/);
  assert.throws(() => validateRead({ venue_id: "broadway", days: [day(today), day(today)] }, "broadway", today), /wrong dates/);
  assert.throws(() => validateRead({ venue_id: "broadway", days: [{ booking_date: today }] }, "broadway", today), /incomplete day/);
});
