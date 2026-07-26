import { getVenueDefinition } from "@/lib/venues";
import { getAvailabilityRecord, getAvailabilityRefreshState } from "@/server/availabilityStore";
import { buildPublicAvailabilityResponse } from "@/server/publicAvailability";
import {
  API_CORS_HEADERS,
  NO_STORE_HEADERS,
  apiPreflight,
  notFoundJson,
  validShareToken,
} from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicAvailabilityRouteContext = Readonly<{
  params: Promise<{
    shareToken: string;
    venueId: string;
  }>;
}>;

export function OPTIONS() {
  return apiPreflight();
}

const RESPONSE_HEADERS = Object.freeze({ ...API_CORS_HEADERS, ...NO_STORE_HEADERS });

export async function GET(_request: Request, { params }: PublicAvailabilityRouteContext) {
  try {
    const { shareToken, venueId } = await params;
    if (!validShareToken(shareToken) || !getVenueDefinition(venueId)) {
      return notFoundJson(RESPONSE_HEADERS);
    }

    const [record, refreshState] = await Promise.all([
      getAvailabilityRecord(venueId),
      getAvailabilityRefreshState(venueId).catch(() => null),
    ]);
    const result = buildPublicAvailabilityResponse(record, { venueId, refreshState });
    return Response.json(result.body, {
      status: result.status,
      headers: RESPONSE_HEADERS,
    });
  } catch {
    return Response.json(
      {
        state: "error",
        message: "We could not load this share page.",
      },
      { status: 500, headers: RESPONSE_HEADERS }
    );
  }
}
