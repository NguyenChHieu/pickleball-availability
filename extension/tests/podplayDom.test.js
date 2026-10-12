const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("PodPlay reads nine unique days when Today and a dated tab refer to the same day", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../providers/podplayDom.js"), "utf8");
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [2026, 9, 13, 12])); }
  }
  let selected = "Today";
  const labels = ["Today", "Tue, 10/13", "Wed, 10/14", "Thu, 10/15", "Fri, 10/16",
    "Sat, 10/17", "Sun, 10/18", "Mon, 10/19", "Tue, 10/20", "Wed, 10/21"];
  const buttons = labels.map((label) => ({ innerText: label, click() { selected = label; } }));
  const row = { innerText: "6 PM 1 open court C2", children: [] };
  const sandbox = {
    Date: FixedDate,
    URL,
    URLSearchParams,
    setTimeout(callback) { queueMicrotask(callback); },
    window: { location: { href: "https://houseofpickle.podplay.app/book/darling-harbour" } },
    document: {
      body: { get innerText() { return selected; } },
      querySelectorAll(selector) { return selector === "button" ? buttons : [row]; },
    },
  };
  vm.runInNewContext(source, sandbox);
  const payload = await sandbox.AvailabilityProviders["podplay-dom"].readAvailability({ readDays: 9 });
  assert.deepEqual(Array.from(payload.days, (day) => day.booking_date),
    Array.from({ length: 9 }, (_, index) => `2026-10-${13 + index}`));
  assert.equal(payload.days[0].same_court_intervals[0].court_name, "C2");
  assert.equal(payload.days[0].open_intervals[0].start_time, "18:00");
});
