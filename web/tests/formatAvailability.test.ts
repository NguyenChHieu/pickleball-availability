import assert from "node:assert/strict";
import test from "node:test";
import { answerForMessage, formatDay } from "../src/server/formatAvailability.ts";

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

test("formatDay preserves ProPickle continuity by court", () => {
  const summary = formatDay({
    date: "Thursday, July 16",
    remaining_hours: 2,
    open_intervals: [{ start_time: "9pm", end_time: "11pm" }],
    same_court_intervals: [
      { court_name: "Court 4", intervals: [{ start_time: "9pm", end_time: "11pm" }] },
      { court_name: "Court 1", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court_name: "Court 2", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court_name: "Court 3", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court_name: "Court 5", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court_name: "Court 6", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
    ],
  });

  assert.match(summary, /any court 9pm-11pm/);
  assert.match(summary, /Court 4: 9pm-11pm/);
  assert.match(summary, /Court 1: 10pm-11pm/);
  assert.match(summary, /Court 2: 10pm-11pm/);
  assert.match(summary, /Court 3: 10pm-11pm/);
  assert.match(summary, /Court 5: 10pm-11pm/);
  assert.match(summary, /Court 6: 10pm-11pm/);
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

test("answerForMessage resolves current venue ids for text summaries", () => {
  const payloads = {
    "house-of-pickle-darling-harbour": {
      venue_name: "House of Pickle DH",
      days: [{ date: "Thursday, July 09", open_intervals: [{ start_time: "12:00", end_time: "13:00" }] }],
    },
    "sydney-racquet-club": {
      venue_name: "Sydney Racquet Club",
      days: [{ date: "Friday, July 10", open_intervals: [{ start_time: "14:00", end_time: "15:00" }] }],
    },
    "wotso-pyrmont": {
      venue_name: "WOTSO Pickleball Pyrmont",
      days: [{ date: "Saturday, July 11", open_intervals: [{ start_time: "16:00", end_time: "17:00" }] }],
    },
  };

  assert.match(answerForMessage("house of pickle availability", payloads), /House of Pickle DH availability/);
  assert.match(answerForMessage("sydney racquet availability", payloads), /Sydney Racquet Club availability/);
  assert.match(answerForMessage("wotso pyrmont availability", payloads), /WOTSO Pickleball Pyrmont availability/);
});

test("answerForMessage keeps old venue id aliases for existing cached text payloads", () => {
  const payloads = {
    "houseofpickle-darlingharbour": {
      venue_name: "Old House Cache",
      days: [{ date: "Sunday, July 12", open_intervals: [{ start_time: "10:00", end_time: "11:00" }] }],
    },
    sydneyracquet: {
      venue_name: "Old Sydney Cache",
      days: [{ date: "Monday, July 13", open_intervals: [{ start_time: "08:00", end_time: "09:00" }] }],
    },
  };

  assert.match(answerForMessage("darling harbour", payloads), /Old House Cache availability/);
  assert.match(answerForMessage("playtomic", payloads), /Old Sydney Cache availability/);
});
