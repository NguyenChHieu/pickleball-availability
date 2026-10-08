const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("Playtomic reader starts on the Sydney date even when the host is on yesterday", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../providers/playtomicAvailability.js"), "utf8");
  const requests = [];
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ["2026-10-08T20:00:00Z"])); }
  }
  const sandbox = {
    URL,
    Date: FixedDate,
    fetch: async (url) => {
      requests.push(new URL(url));
      return { ok: true, json: async () => [] };
    },
    window: { location: { href: "https://playtomic.com/clubs/sydney-racquet-club?sport_id=PICKLEBALL" } },
  };
  vm.runInNewContext(source, sandbox);
  const payload = await sandbox.AvailabilityProviders["playtomic-availability"].readAvailability({
    tenantId: "test-tenant", readDays: 2, timezone: "Australia/Sydney",
  });
  assert.equal(requests[0].searchParams.get("date"), "2026-10-09");
  assert.equal(payload.days[0].booking_date, "2026-10-09");
  assert.equal(payload.days[1].booking_date, "2026-10-10");
});

test("Playtomic reader rejects malformed success responses instead of reporting fully booked", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../providers/playtomicAvailability.js"), "utf8");
  const sandbox = {
    URL,
    fetch: async () => ({ ok: true, json: async () => ({ error: "unexpected shape" }) }),
    window: { location: { href: "https://playtomic.com/clubs/sydney-racquet-club?sport_id=PICKLEBALL" } },
  };
  vm.runInNewContext(source, sandbox);

  await assert.rejects(
    sandbox.AvailabilityProviders["playtomic-availability"].readAvailability({
      tenantId: "test-tenant",
      readDays: 1,
    }),
    /invalid response/
  );
});
