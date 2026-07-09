const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const scriptPath = path.resolve(__dirname, "propickle-probes.js");

function targetPayload(court4Intervals) {
  return {
    venue_name: "ProPickle",
    days: [
      {
        date: "Thursday, July 16",
        continuity_status: "available",
        open_intervals: [{ start_time: "9pm", end_time: "11pm" }],
        same_court_intervals: [
          { court_name: "Court 1", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
          { court_name: "Court 2", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
          { court_name: "Court 3", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
          { court_name: "Court 4", intervals: court4Intervals },
          { court_name: "Court 5", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
          { court_name: "Court 6", intervals: [{ start_time: "10pm", end_time: "11pm" }] },
        ],
        probe_debug: [],
      },
    ],
  };
}

function runWithPayload(payload) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "propickle-probes-"));
  const payloadPath = path.join(dir, "payload.json");
  fs.writeFileSync(payloadPath, JSON.stringify(payload), "utf8");

  try {
    return spawnSync(process.execPath, [scriptPath, payloadPath, "Thursday, July 16", "--assert-target"], {
      encoding: "utf8",
    });
  } finally {
    fs.rmSync(dir, { force: true, recursive: true });
  }
}

test("propickle probe assert-target passes the expected July 16 split", () => {
  const result = runWithPayload(targetPayload([{ start_time: "9pm", end_time: "10pm" }]));

  assert.equal(result.status, 0);
  assert.match(result.stdout, /target split: PASS/);
});

test("propickle probe assert-target fails when Court 4 covers 10-11pm", () => {
  const result = runWithPayload(targetPayload([{ start_time: "9pm", end_time: "11pm" }]));

  assert.equal(result.status, 1);
  assert.match(result.stdout, /target split: FAIL/);
  assert.match(result.stdout, /court 4 should not cover 10pm-11pm/);
});
