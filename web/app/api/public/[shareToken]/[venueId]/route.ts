import { getAvailabilityRecord, getAvailabilityRefreshState } from "@/server/availabilityStore";
import { buildPublicAvailabilityResponse } from "@/server/publicAvailability";
import { API_CORS_HEADERS, apiPreflight, notFoundJson, validShareToken } from "@/server/security";

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

export async function GET(_request: Request, { params }: PublicAvailabilityRouteContext) {
  try {
    const { shareToken, venueId } = await params;
    if (!validShareToken(shareToken)) return notFoundJson(API_CORS_HEADERS);

    const [record, refreshState] = await Promise.all([
      getAvailabilityRecord(venueId),
      getAvailabilityRefreshState(venueId).catch(() => null),
    ]);
    const result = buildPublicAvailabilityResponse(record, { venueId, refreshState });
    return Response.json(result.body, {
      status: result.status,
      headers: API_CORS_HEADERS,
    });
  } catch {
    return Response.json(
      {
        state: "error",
        message: "We could not load this share page.",
      },
      { status: 500, headers: API_CORS_HEADERS }
    );
  }
}
