import { randomUUID } from "node:crypto";

export type AvailabilityRefreshAttempt = Readonly<{
  attempt_id: string;
  started_at: string;
}>;

const ATTEMPT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const MAX_ATTEMPT_AGE_MS = 90 * 60 * 1000;
const MAX_ATTEMPT_FUTURE_MS = 60 * 1000;

export function createAvailabilityRefreshAttempt(): AvailabilityRefreshAttempt {
  return {
    attempt_id: randomUUID(),
    started_at: new Date().toISOString(),
  };
}

export function parseAvailabilityRefreshAttempt(headers: Headers, now = Date.now()) {
  const attemptId = headers.get("x-refresh-attempt-id")?.trim() || "";
  const startedAt = headers.get("x-refresh-started-at")?.trim() || "";
  if (!attemptId && !startedAt) return null;

  if (!ATTEMPT_ID_PATTERN.test(attemptId)) {
    throw new Error("Invalid refresh attempt id.");
  }
  const startedTime = Date.parse(startedAt);
  if (!startedAt || Number.isNaN(startedTime)) {
    throw new Error("Invalid refresh attempt start time.");
  }
  if (startedTime < now - MAX_ATTEMPT_AGE_MS) {
    throw new Error("Invalid refresh attempt: it has expired.");
  }
  if (startedTime > now + MAX_ATTEMPT_FUTURE_MS) {
    throw new Error("Invalid refresh attempt: start time is in the future.");
  }

  return {
    attempt_id: attemptId,
    started_at: new Date(startedTime).toISOString(),
  } satisfies AvailabilityRefreshAttempt;
}
