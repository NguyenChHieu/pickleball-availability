const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

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
