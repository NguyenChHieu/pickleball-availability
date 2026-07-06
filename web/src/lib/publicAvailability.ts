import { getAvailabilityRecord } from "@/server/availabilityStore";
import { buildPublicAvailabilityResponse } from "@/server/publicAvailability";
import { validShareToken } from "@/server/security";

const SAFE_ERROR_MESSAGE = "We could not load this share page.";

export type PublicAvailabilityInterval = {
  startTime: string;
  endTime: string;
  label: string;
};

export type PublicAvailabilityCourtIntervals = {
  courtName: string;
  providerName: string;
  levelName: string;
  price: string;
  intervals: PublicAvailabilityInterval[];
};

export type PublicAvailabilityLevelIntervals = {
  levelName: string;
  price: string;
  intervals: PublicAvailabilityInterval[];
};

export type PublicAvailabilityDay = {
  date: string;
  title: string;
  totalOpenHours: number;
  openIntervals: PublicAvailabilityInterval[];
  sameCourtIntervals: PublicAvailabilityCourtIntervals[];
  levelIntervals: PublicAvailabilityLevelIntervals[];
  bookingUrl?: string;
};

export type PublicAvailabilityReady = {
  state: "ready";
  venueId: string;
  venueName: string;
  themeId: string;
  lastReadAt: string | null;
  freshnessLabel: string;
  isStale: boolean;
  staleThresholdHours: number;
  summary: {
    dayCount: number;
    totalOpenHours: number;
  };
  days: PublicAvailabilityDay[];
  fallbackUrl: string;
};

export type PublicAvailabilityEmpty = {
  state: "empty";
  message: string;
  fallbackUrl: string;
};

export type PublicAvailabilityError = {
  state: "error";
  message: string;
  fallbackUrl?: string;
};

export type PublicAvailabilityNotFound = {
  state: "not-found";
  message: string;
  fallbackUrl?: string;
};

export type PublicAvailability =
  | PublicAvailabilityReady
  | PublicAvailabilityEmpty
  | PublicAvailabilityError
  | PublicAvailabilityNotFound;

function hasState(value: unknown, state: string) {
  return Boolean(
    value &&
      typeof value === "object" &&
      "state" in value &&
      (value as { state?: unknown }).state === state
  );
}

function isReadyAvailability(value: unknown): value is PublicAvailabilityReady {
  return hasState(value, "ready");
}

function isEmptyAvailability(value: unknown): value is PublicAvailabilityEmpty {
  return hasState(value, "empty");
}

export async function fetchPublicAvailability(
  shareToken: string,
  venueId: string
): Promise<PublicAvailability> {
  try {
    if (!validShareToken(shareToken)) {
      return {
        state: "not-found",
        message: SAFE_ERROR_MESSAGE,
      };
    }

    const record = await getAvailabilityRecord(venueId);
    const result = buildPublicAvailabilityResponse(record, { venueId });
    const body: unknown = result.body;

    if (result.status === 200 && isReadyAvailability(body)) return body;
    if (result.status === 404 && isEmptyAvailability(body)) return body;
    if (result.status === 404) {
      return {
        state: "not-found",
        message: SAFE_ERROR_MESSAGE,
      };
    }

    return {
      state: "error",
      message: SAFE_ERROR_MESSAGE,
    };
  } catch {
    return {
      state: "error",
      message: SAFE_ERROR_MESSAGE,
    };
  }
}
