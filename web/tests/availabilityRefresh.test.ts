import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPublicRefreshHealth,
  parseAvailabilityRefreshReport,
  type AvailabilityRefreshState,
} from "../src/server/availabilityRefresh.ts";
import { buildPublicAvailabilityResponse } from "../src/server/publicAvailability.ts";

function refreshState(overrides: Partial<AvailabilityRefreshState> = {}): AvailabilityRefreshState {
  return {
    venue_id: "propickle",
    attempted_at: "2026-07-24T10:08:00.000Z",
    status: "failed",
    duration_ms: 1200,
    source: "selected",
    ...overrides,
  };
}

test("refresh report parser accepts only allowlisted bounded values", () => {
  assert.deepEqual(
    parseAvailabilityRefreshReport({ status: "success", duration_ms: 1234, source: "selected" }),
    { status: "success", duration_ms: 1234, source: "selected" }
  );
  assert.throws(
    () => parseAvailabilityRefreshReport({ status: "error", duration_ms: 1234, source: "selected" }),
    /status/i
  );
  assert.throws(
    () => parseAvailabilityRefreshReport({ status: "failed", duration_ms: -1, source: "selected" }),
    /duration/i
  );
  assert.throws(
    () => parseAvailabilityRefreshReport({ status: "failed", duration_ms: 100, source: "scheduler" }),
    /source/i
  );
  assert.throws(
    () =>
      parseAvailabilityRefreshReport({
        status: "failed",
        duration_ms: 100,
        source: "selected",
        error: "raw provider details",
      }),
    /fields/i
  );
  assert.throws(
    () => parseAvailabilityRefreshReport({ status: "failed", durationMs: 100, source: "selected" }),
    /fields/i
  );
  assert.throws(
    () => parseAvailabilityRefreshReport({ status: "failed", duration_ms: "100", source: "selected" }),
    /duration/i
  );
});

test("newer refresh failure preserves and describes the last successful read", () => {
  const health = buildPublicRefreshHealth(
    refreshState(),
    "2026-07-24T09:50:00.000Z",
    "2026-07-24T10:10:00.000Z"
  );

  assert.equal(health.hasNewerIssue, true);
  assert.match(health.message, /Refresh failed 2m ago/);
  assert.match(health.message, /successful read from 20m ago/);
});

test("a success newer than the recorded failure clears the warning", () => {
  const health = buildPublicRefreshHealth(
    refreshState({ attempted_at: "2026-07-24T09:50:00.000Z" }),
    "2026-07-24T10:08:00.000Z",
    "2026-07-24T10:10:00.000Z"
  );

  assert.equal(health.hasNewerIssue, false);
  assert.equal(health.message, "");
});

test("first failed refresh has an informative empty state", () => {
  const response = buildPublicAvailabilityResponse(null, {
    venueId: "propickle",
    now: "2026-07-24T10:10:00.000Z",
    refreshState: refreshState(),
  });

  assert.equal(response.status, 404);
  assert.equal(response.body.state, "empty");
  assert.match(response.body.refreshHealth.message, /No successful read is available yet/);
});

test("setup-required attempts use an actionable but non-sensitive warning", () => {
  const health = buildPublicRefreshHealth(
    refreshState({ status: "setup_required" }),
    "2026-07-24T09:50:00.000Z",
    "2026-07-24T10:10:00.000Z"
  );

  assert.equal(health.hasNewerIssue, true);
  assert.match(health.message, /Refresh needs venue setup/);
  assert.doesNotMatch(health.message, /login|password|error/i);
});

test("cache reuse is healthy and clears an older warning", () => {
  const health = buildPublicRefreshHealth(
    refreshState({ status: "cache_reused" }),
    "2026-07-24T09:50:00.000Z",
    "2026-07-24T10:10:00.000Z"
  );

  assert.equal(health.hasNewerIssue, false);
  assert.equal(health.message, "");
});

test("warning comparison uses the server-received cache time", () => {
  const response = buildPublicAvailabilityResponse(
    {
      venue_id: "propickle",
      received_at: "2026-07-24T10:09:00.000Z",
      payload: {
        venue_id: "propickle",
        exported_at: "2026-07-24T09:00:00.000Z",
        days: [{ date: "2026-07-25", open_intervals: [] }],
      },
    },
    {
      venueId: "propickle",
      now: "2026-07-24T10:10:00.000Z",
      refreshState: refreshState(),
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.refreshHealth.hasNewerIssue, false);
});

test("public availability exposes safe health without internal duration or source", () => {
  const response = buildPublicAvailabilityResponse(
    {
      venue_id: "propickle",
      received_at: "2026-07-24T09:50:00.000Z",
      payload: {
        venue_id: "propickle",
        exported_at: "2026-07-24T09:50:00.000Z",
        days: [{ date: "2026-07-25", open_intervals: [] }],
      },
    },
    {
      venueId: "propickle",
      now: "2026-07-24T10:10:00.000Z",
      refreshState: refreshState({ source: "deep", duration_ms: 98765 }),
    }
  );

  const serialized = JSON.stringify(response.body);
  assert.match(serialized, /refreshHealth/);
  assert.doesNotMatch(serialized, /duration_ms|durationMs|source|deep/);
});
