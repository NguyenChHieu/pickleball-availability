import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("refresh-state writes stay separate from the last successful payload", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pbb-refresh-store-"));
  const previousDirectory = process.env.AVAILABILITY_DATA_DIR;
  const previousSupabaseUrl = process.env.SUPABASE_URL;
  const previousSupabaseKey = process.env.SUPABASE_SECRET_KEY;

  process.env.AVAILABILITY_DATA_DIR = directory;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;

  try {
    const store = await import(`../src/server/availabilityStore.ts?local-refresh-${Date.now()}`);
    await store.saveAvailability("propickle", {
      venue_id: "propickle",
      exported_at: "2026-07-24T10:00:00.000Z",
      days: [{ date: "2026-07-25", open_intervals: [] }],
    });
    const before = await store.getAvailabilityRecord("propickle");

    await store.saveAvailabilityRefreshState("propickle", {
      status: "failed",
      duration_ms: 1500,
      source: "selected",
    });

    const after = await store.getAvailabilityRecord("propickle");
    const refreshState = await store.getAvailabilityRefreshState("propickle");
    assert.deepEqual(after?.payload, before?.payload);
    assert.equal(refreshState?.status, "failed");
    assert.equal(refreshState?.duration_ms, 1500);

    const cacheFile = JSON.parse(await readFile(path.join(directory, "propickle.json"), "utf8"));
    assert.equal(cacheFile.payload.exported_at, "2026-07-24T10:00:00.000Z");
  } finally {
    if (previousDirectory === undefined) delete process.env.AVAILABILITY_DATA_DIR;
    else process.env.AVAILABILITY_DATA_DIR = previousDirectory;
    if (previousSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousSupabaseUrl;
    if (previousSupabaseKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousSupabaseKey;
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing Supabase refresh-state migration degrades without breaking cache reads", async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SECRET_KEY;
  const previousFetch = globalThis.fetch;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-service-key";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        code: "PGRST205",
        message: "Could not find the table 'public.availability_refresh_state' in the schema cache",
      }),
      { status: 404, headers: { "content-type": "application/json" } }
    );

  try {
    const store = await import(`../src/server/availabilityStore.ts?missing-refresh-${Date.now()}`);
    const saved = await store.saveAvailabilityRefreshState("propickle", {
      status: "failed",
      duration_ms: 100,
      source: "selected",
    });

    assert.equal(saved.persisted, false);
    assert.equal(await store.getAvailabilityRefreshState("propickle"), null);
    assert.deepEqual(await store.getAllAvailabilityRefreshStates(), {});
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousKey;
  }
});
