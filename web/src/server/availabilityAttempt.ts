import { randomUUID } from "node:crypto";

export type AvailabilityRefreshAttempt = Readonly<{
  attempt_id: string;
  started_at: string;
}>;

const ATTEMPT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

export function createAvailabilityRefreshAttempt(): AvailabilityRefreshAttempt {
  return {
    attempt_id: randomUUID(),
    started_at: new Date().toISOString(),
  };
}

export function parseAvailabilityRefreshAttempt(headers: Headers) {
  const attemptId = headers.get("x-refresh-attempt-id")?.trim() || "";
  const startedAt = headers.get("x-refresh-started-at")?.trim() || "";
  if (!attemptId && !startedAt) return null;

  if (!ATTEMPT_ID_PATTERN.test(attemptId)) {
    throw new Error("Invalid refresh attempt id.");
  }
  if (!startedAt || Number.isNaN(Date.parse(startedAt))) {
    throw new Error("Invalid refresh attempt start time.");
  }

  return {
    attempt_id: attemptId,
    started_at: new Date(startedAt).toISOString(),
  } satisfies AvailabilityRefreshAttempt;
}
