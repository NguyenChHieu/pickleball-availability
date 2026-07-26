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
  const now = Date.parse("2026-07-24T10:10:00.000Z");
  assert.equal(parseAvailabilityRefreshAttempt(new Headers()), null);
  assert.deepEqual(
    parseAvailabilityRefreshAttempt(
      new Headers({
        "x-refresh-attempt-id": "attempt_12345678",
        "x-refresh-started-at": "2026-07-24T10:00:00.000Z",
      }),
      now
    ),
    {
      attempt_id: "attempt_12345678",
      started_at: "2026-07-24T10:00:00.000Z",
    }
  );
  assert.throws(
    () =>
      parseAvailabilityRefreshAttempt(
        new Headers({ "x-refresh-attempt-id": "attempt_12345678" }),
        now
      ),
    /start time/i
  );
  assert.throws(
    () =>
      parseAvailabilityRefreshAttempt(
        new Headers({
          "x-refresh-attempt-id": "bad id",
          "x-refresh-started-at": "2026-07-24T10:00:00.000Z",
        }),
        now
      ),
    /attempt id/i
  );
});

test("refresh attempt headers reject expired and future timestamps", () => {
  const now = Date.parse("2026-07-24T11:40:00.000Z");
  const headers = (startedAt: string) =>
    new Headers({
      "x-refresh-attempt-id": "attempt_12345678",
      "x-refresh-started-at": startedAt,
    });

  assert.throws(
    () => parseAvailabilityRefreshAttempt(headers("2026-07-24T10:09:59.000Z"), now),
    /expired/i
  );
  assert.throws(
    () => parseAvailabilityRefreshAttempt(headers("2026-07-24T11:41:01.000Z"), now),
    /future/i
  );
  assert.equal(
    parseAvailabilityRefreshAttempt(headers("2026-07-24T10:10:00.000Z"), now)?.started_at,
    "2026-07-24T10:10:00.000Z"
  );
});
