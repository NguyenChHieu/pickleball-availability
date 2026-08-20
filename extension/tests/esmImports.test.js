const assert = require("node:assert/strict");
const test = require("node:test");

// background.js and popup.js are real ES modules (manifest.json declares
// "type": "module" for the service worker; popup.html loads popup.js with
// type="module"). The vm-based tests in backgroundReaderWindow.test.js strip
// import/export syntax and run everything as one flat script for mocking
// convenience - that never actually proves the import graph itself resolves.
// This file uses Node's real dynamic import() (the same module resolution/
// linking algorithm a browser uses) to prove that independently: a typo'd
// export name, a wrong specifier path, or a renamed function that isn't
// updated everywhere would fail here even if every mocked test still passes.

test("sync.js exports exactly what background.js imports from it", async () => {
  const syncModule = await import("../sync.js");
  const exported = Object.keys(syncModule).sort();
  const importedByBackground = [
    "beginRefreshAttempt",
    "normalizeStoredBackendUrl",
    "reportRefreshStatus",
    "refreshStatusForSync",
    "storedBackendSyncConfig",
    "syncStatusKey",
    "syncVenuePayload",
  ].sort();
  assert.deepEqual(exported, importedByBackground);
});

test("venues.js exports AvailabilityRegistry with the shape background.js and popup.js rely on", async () => {
  const venuesModule = await import("../venues.js");
  assert.deepEqual(Object.keys(venuesModule), ["AvailabilityRegistry"]);
  const registry = venuesModule.AvailabilityRegistry;
  for (const key of ["getVenues", "getVenue", "findVenueForUrl", "venuePayloadKey", "DEFAULT_VENUE_ID", "SELECTED_VENUE_KEY"]) {
    assert.ok(key in registry, `AvailabilityRegistry is missing "${key}"`);
  }
});

test("background.js's import graph resolves (fails only on the missing chrome global, not on imports)", async () => {
  await assert.rejects(
    () => import("../background.js"),
    (error) => error instanceof ReferenceError && /\bchrome\b/.test(error.message)
  );
});

test("popup.js's import graph resolves (fails only on the missing document global, not on imports)", async () => {
  await assert.rejects(
    () => import("../popup.js"),
    (error) => error instanceof ReferenceError && /\bdocument\b/.test(error.message)
  );
});
