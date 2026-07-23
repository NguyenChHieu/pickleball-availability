export const AVAILABILITY_REFRESH_STATUSES = [
  "success",
  "failed",
  "setup_required",
  "cache_reused",
] as const;

export const AVAILABILITY_REFRESH_SOURCES = [
  "selected",
  "stale",
  "all",
  "deep",
  "current_page",
] as const;

export type AvailabilityRefreshStatus = (typeof AVAILABILITY_REFRESH_STATUSES)[number];
export type AvailabilityRefreshSource = (typeof AVAILABILITY_REFRESH_SOURCES)[number];

export type AvailabilityRefreshReport = {
  status: AvailabilityRefreshStatus;
  duration_ms: number;
  source: AvailabilityRefreshSource;
};

export type AvailabilityRefreshState = AvailabilityRefreshReport & {
  venue_id: string;
  attempted_at: string;
};

export type PublicRefreshHealth = {
  status: AvailabilityRefreshStatus | "unknown";
  attemptedAt: string | null;
  hasNewerIssue: boolean;
  message: string;
};

const MAX_REFRESH_DURATION_MS = 30 * 60 * 1000;
const STATUS_SET = new Set<string>(AVAILABILITY_REFRESH_STATUSES);
const SOURCE_SET = new Set<string>(AVAILABILITY_REFRESH_SOURCES);
const REPORT_KEYS = new Set(["status", "duration_ms", "source"]);

export function parseAvailabilityRefreshReport(value: unknown): AvailabilityRefreshReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid refresh report.");
  }

  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !REPORT_KEYS.has(key))) {
    throw new Error("Invalid refresh report fields.");
  }

  const status = input.status;
  const source = input.source;
  const duration = input.duration_ms;

  if (typeof status !== "string" || !STATUS_SET.has(status)) throw new Error("Invalid refresh status.");
  if (typeof source !== "string" || !SOURCE_SET.has(source)) throw new Error("Invalid refresh source.");
  if (typeof duration !== "number" || !Number.isInteger(duration) || duration < 0 || duration > MAX_REFRESH_DURATION_MS) {
    throw new Error("Invalid refresh duration.");
  }

  return {
    status: status as AvailabilityRefreshStatus,
    duration_ms: duration,
    source: source as AvailabilityRefreshSource,
  };
}

export function compactAge(value: string | null, now: Date | number | string = Date.now()) {
  if (!value) return "not read yet";
  const valueTime = new Date(value).getTime();
  const nowTime = new Date(now).getTime();
  if (!Number.isFinite(valueTime) || !Number.isFinite(nowTime)) return "at an unknown time";

  const minutes = Math.max(0, Math.floor((nowTime - valueTime) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function buildPublicRefreshHealth(
  refreshState: AvailabilityRefreshState | null | undefined,
  lastSuccessfulAt: string | null,
  now: Date | number | string = Date.now()
): PublicRefreshHealth {
  if (!refreshState) {
    return { status: "unknown", attemptedAt: null, hasNewerIssue: false, message: "" };
  }

  const attemptedAt = refreshState.attempted_at || null;
  const attemptedTime = new Date(attemptedAt || "").getTime();
  const successfulTime = new Date(lastSuccessfulAt || "").getTime();
  const isIssue = refreshState.status === "failed" || refreshState.status === "setup_required";
  const hasSuccessfulTime = Number.isFinite(successfulTime);
  const hasNewerIssue = isIssue && Number.isFinite(attemptedTime) && (!hasSuccessfulTime || attemptedTime > successfulTime);

  if (!hasNewerIssue) {
    return { status: refreshState.status, attemptedAt, hasNewerIssue: false, message: "" };
  }

  const issueLabel = refreshState.status === "setup_required" ? "Refresh needs venue setup" : "Refresh failed";
  const issueAge = compactAge(attemptedAt, now);
  const message = hasSuccessfulTime
    ? `${issueLabel} ${issueAge}. Showing the successful read from ${compactAge(lastSuccessfulAt, now)}.`
    : `${issueLabel} ${issueAge}. No successful read is available yet.`;

  return {
    status: refreshState.status,
    attemptedAt,
    hasNewerIssue: true,
    message,
  };
}
