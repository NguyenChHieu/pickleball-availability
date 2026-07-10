const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { targetSplitFailures } = require(path.resolve(__dirname, "../probeTargetSplit.js"));

function dayWithCourt4(intervals, continuityStatus = "available") {
  return {
    continuity_status: continuityStatus,
    same_court_intervals: [
      { court_name: "Court 1", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court_name: "Court 2", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court_name: "Court 3", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court_name: "Court 4", intervals },
      { court_name: "Court 5", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
      { court_name: "Court 6", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
    ],
  };
}

test("target split passes the expected Court 4 and other-court intervals", () => {
  assert.deepEqual(targetSplitFailures(dayWithCourt4([{ start_time: "9pm", end_time: "11pm" }])), []);
});

test("target split fails when Court 4 does not cover 10-11pm", () => {
  const failures = targetSplitFailures(dayWithCourt4([{ start_time: "9pm", end_time: "10pm" }]));

  assert.deepEqual(failures, ["court 4 missing 10pm-11pm"]);
});

test("target split fails when continuity is not fully available", () => {
  const failures = targetSplitFailures(dayWithCourt4([{ start_time: "9pm", end_time: "11pm" }], "partial"));

  assert.deepEqual(failures, ["continuity_status should be available, got partial"]);
});
