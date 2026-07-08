import assert from "node:assert/strict";
import test from "node:test";
import { formatDay } from "../src/server/formatAvailability.ts";

test("formatDay keeps any-court intervals separate from same-court runs", () => {
  const summary = formatDay({
    date: "Monday, July 06",
    remaining_hours: 1,
    open_intervals: [{ start_time: "18:00", end_time: "19:00" }],
    same_court_intervals: [
      {
        court_name: "Court 1",
        intervals: [{ start_time: "18:00", end_time: "18:30" }],
      },
      {
        court_name: "Court 4",
        intervals: [{ start_time: "18:30", end_time: "19:00" }],
      },
    ],
  });

  assert.match(summary, /any court 18:00-19:00/);
  assert.match(summary, /Court 1: 18:00-18:30/);
  assert.match(summary, /Court 4: 18:30-19:00/);
});

test("formatDay includes booking levels and partial continuity warning", () => {
  const summary = formatDay({
    date: "Tuesday, July 07",
    remaining_hours: 1.5,
    continuity_status: "partial",
    open_intervals: [{ start_time: "09:00", end_time: "10:30" }],
    level_intervals: [
      {
        level_name: "Premium Pickleball",
        price: "A$15.00",
        intervals: [{ start_time: "09:00", end_time: "09:30" }],
      },
    ],
  });

  assert.match(summary, /levels Premium Pickleball A\$15\.00: 09:00-09:30/);
  assert.match(summary, /continuity partially read/);
});

test("formatDay shows no open intervals without inventing court detail", () => {
  const summary = formatDay({
    date: "Wednesday, July 08",
    open_intervals: [],
    same_court_intervals: [
      {
        court_name: "Court 2",
        intervals: [{ start_time: "11:00", end_time: "11:30" }],
      },
    ],
  });

  assert.equal(summary, "Wednesday, July 08: no open intervals");
});
