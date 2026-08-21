const assert = require("node:assert/strict");
const test = require("node:test");

// background.js and every module it imports are real ES modules (manifest.json
// declares "type": "module" for the service worker; popup.html loads popup.js
// with type="module"). The vm-based tests in backgroundReaderWindow.test.js
// strip import/export syntax and concatenate everything into one flat script
// for mocking convenience - that proves the logic works, but NOT that each
// file's own import list is correct, because in a flat script every binding
// is already in scope regardless of which file "actually" imported it. This
// file uses Node's real dynamic import() (the same resolution/linking
// algorithm a browser uses) to prove that independently.
//
// This caught two real bugs while writing the readerWindow/pendingRefresh/
// refreshJob split: tabReader.js's cacheFirstPayload called
// storedBackendSyncConfig/syncStatusKey/normalizeStoredBackendUrl without
// importing them, and refreshJob.js's refreshVenueForJob called
// reportRefreshStatus without importing it. Both were inside function bodies
// (not module top-level), so a bare successful import() didn't catch them -
// the concatenated harness didn't either, for the reason above - only
// actually calling the function through a real import did.

test("sync.js exports exactly what its importers need from it", async () => {
  const syncModule = await import("../sync.js");
  const exported = new Set(Object.keys(syncModule));
  const neededBy = {
    "background.js": ["beginRefreshAttempt", "reportRefreshStatus", "refreshStatusForSync"],
    "tabReader.js": ["normalizeStoredBackendUrl", "storedBackendSyncConfig", "syncStatusKey", "syncVenuePayload"],
    "pendingRefresh.js": ["reportRefreshStatus", "refreshStatusForSync"],
    "refreshJob.js": ["beginRefreshAttempt", "reportRefreshStatus"],
  };
  for (const [importer, names] of Object.entries(neededBy)) {
    for (const name of names) {
      assert.ok(exported.has(name), `sync.js is missing "${name}", needed by ${importer}`);
    }
  }
});

test("venues.js exports AvailabilityRegistry with the shape background.js and popup.js rely on", async () => {
  const venuesModule = await import("../venues.js");
  assert.deepEqual(Object.keys(venuesModule), ["AvailabilityRegistry"]);
  const registry = venuesModule.AvailabilityRegistry;
  for (const key of ["getVenues", "getVenue", "findVenueForUrl", "venuePayloadKey", "DEFAULT_VENUE_ID", "SELECTED_VENUE_KEY"]) {
    assert.ok(key in registry, `AvailabilityRegistry is missing "${key}"`);
  }
});

test("tabReader.js exports exactly what its importers need from it", async () => {
  const tabReaderModule = await import("../tabReader.js");
  const exported = new Set(Object.keys(tabReaderModule));
  for (const name of ["waitForTabComplete", "readTab", "venueForScanMode", "saveVenuePayload", "cacheFirstPayload", "wait"]) {
    assert.ok(exported.has(name), `tabReader.js is missing "${name}"`);
  }
});

test("readerWindow.js exports exactly what its importers need from it", async () => {
  const readerWindowModule = await import("../readerWindow.js");
  const exported = new Set(Object.keys(readerWindowModule));
  for (const name of [
    "releaseRefreshReaderWindow",
    "tabForVenue",
    "activateTab",
    "focusTab",
    "closeTab",
    "forgetReaderTab",
    "forgetReaderWindow",
  ]) {
    assert.ok(exported.has(name), `readerWindow.js is missing "${name}"`);
  }
});

test("pendingRefresh.js exports exactly what its importers need from it", async () => {
  const pendingRefreshModule = await import("../pendingRefresh.js");
  const exported = new Set(Object.keys(pendingRefreshModule));
  for (const name of [
    "loadPendingRefreshes",
    "tabIdFromPendingRefreshAlarm",
    "clearPendingRefresh",
    "savePendingRefresh",
    "pendingRefreshSession",
    "continuePendingRefresh",
    "normalizeRefreshSource",
  ]) {
    assert.ok(exported.has(name), `pendingRefresh.js is missing "${name}"`);
  }
});

test("refreshJob.js exports exactly what its importers need from it", async () => {
  const refreshJobModule = await import("../refreshJob.js");
  const exported = new Set(Object.keys(refreshJobModule));
  for (const name of ["openPendingSetupWindow", "pendingSetupVenueIds", "storedRefreshHistory", "currentRefreshJob", "startRefreshJob"]) {
    assert.ok(exported.has(name), `refreshJob.js is missing "${name}"`);
  }
});

test("cacheFirstPayload runs through a real import without a ReferenceError from a missed sync.js import", async () => {
  // Regression test for the first bug this file's approach caught: this
  // function reads storedBackendSyncConfig/syncStatusKey/normalizeStoredBackendUrl,
  // none of which are its own arguments, so only a call through a real
  // module graph (not the concatenated test harness) can catch a missing
  // import here. The mock storage must satisfy every early-return guard
  // (a truthy cached payload, then an enabled sync config with a
  // backendUrl) so execution actually reaches all three calls instead of
  // returning null before it gets there.
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      local: {
        get: async () => ({
          "availability:venue:propickle": { exported_at: new Date().toISOString(), days: [] },
          backendSyncConfig: { enabled: true, backendUrl: "http://localhost:3007" },
          "backendSyncStatus:propickle": { ok: true, backend_url: "http://localhost:3007" },
        }),
      },
    },
  };
  try {
    const { cacheFirstPayload } = await import(`../tabReader.js?esmSmoke=${Date.now()}`);
    const result = await cacheFirstPayload({ id: "propickle", cacheFirstTtlMs: 300000 }, "cache-first");
    assert.deepEqual(result, { exported_at: result.exported_at, days: [] });
  } finally {
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
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
