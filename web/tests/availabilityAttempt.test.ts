import assert from "node:assert/strict";
import test from "node:test";

import {
  createAvailabilityRefreshAttempt,
  parseAvailabilityRefreshAttempt,
} from "../src/server/availabilityAttempt.ts";

test("refresh attempts use a server timestamp and bounded opaque id", () => {
  const attempt = createAvailabilityRefreshAttempt();
  assert.match(attempt.attempt_id, /^[a-zA-Z0-9_-]{8,128}$/);
  assert.equal(Number.isNaN(Date.parse(attempt.started_at)), false);
});

test("refresh attempt headers are optional but must be complete", () => {
  assert.equal(parseAvailabilityRefreshAttempt(new Headers()), null);
  assert.deepEqual(
    parseAvailabilityRefreshAttempt(
      new Headers({
        "x-refresh-attempt-id": "attempt_12345678",
        "x-refresh-started-at": "2026-07-24T10:00:00.000Z",
      })
    ),
    {
      attempt_id: "attempt_12345678",
      started_at: "2026-07-24T10:00:00.000Z",
    }
  );
  assert.throws(
    () => parseAvailabilityRefreshAttempt(new Headers({ "x-refresh-attempt-id": "attempt_12345678" })),
    /start time/i
  );
  assert.throws(
    () =>
      parseAvailabilityRefreshAttempt(
        new Headers({
          "x-refresh-attempt-id": "bad id",
          "x-refresh-started-at": "2026-07-24T10:00:00.000Z",
        })
      ),
    /attempt id/i
  );
});
