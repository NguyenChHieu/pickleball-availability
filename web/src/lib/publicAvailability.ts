const DEFAULT_BACKEND_URL = "http://localhost:8787";
const SAFE_ERROR_MESSAGE = "We could not load this share page.";

export type PublicAvailabilityInterval = {
  startTime: string;
  endTime: string;
  label: string;
};

export type PublicAvailabilityDay = {
  date: string;
  title: string;
  totalOpenHours: number;
  openIntervals: PublicAvailabilityInterval[];
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

function backendBaseUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, "");
}

function publicAvailabilityUrl(shareToken: string, venueId: string) {
  return `${backendBaseUrl()}/api/public/${encodeURIComponent(shareToken)}/${encodeURIComponent(venueId)}`;
}

function hasState(value: unknown, state: string) {
  return Boolean(value && typeof value === "object" && "state" in value && value.state === state);
}

function isReadyAvailability(value: unknown): value is PublicAvailabilityReady {
  return hasState(value, "ready");
}

function isEmptyAvailability(value: unknown): value is PublicAvailabilityEmpty {
  return hasState(value, "empty");
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function fetchPublicAvailability(
  shareToken: string,
  venueId: string
): Promise<PublicAvailability> {
  let response: Response;

  try {
    response = await fetch(publicAvailabilityUrl(shareToken, venueId), {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });
  } catch {
    return {
      state: "error",
      message: SAFE_ERROR_MESSAGE,
    };
  }

  const body = await readJson(response);

  if (response.ok && isReadyAvailability(body)) return body;
  if (response.status === 404 && isEmptyAvailability(body)) return body;
  if (response.status === 404) {
    return {
      state: "not-found",
      message: SAFE_ERROR_MESSAGE,
    };
  }

  return {
    state: "error",
    message: SAFE_ERROR_MESSAGE,
  };
}
