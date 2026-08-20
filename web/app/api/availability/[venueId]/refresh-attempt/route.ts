import { getVenueDefinition } from "@/lib/venues";
import { createAvailabilityRefreshAttempt } from "@/server/availabilityAttempt";
import { safeVenueId } from "@/server/availabilityStore";
import { SYNC_RESPONSE_HEADERS, requireSyncToken, syncPreflight } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RefreshAttemptRouteContext = Readonly<{
  params: Promise<{ venueId: string }>;
}>;

export function OPTIONS() {
  return syncPreflight();
}

export async function POST(request: Request, { params }: RefreshAttemptRouteContext) {
  const unauthorized = requireSyncToken(request);
  if (unauthorized) return unauthorized;

  const { venueId } = await params;
  const normalizedVenueId = safeVenueId(venueId);
  if (!getVenueDefinition(normalizedVenueId)) {
    return Response.json({ error: "Unknown venue." }, { status: 400, headers: SYNC_RESPONSE_HEADERS });
  }

  return Response.json(
    {
      ok: true,
      venue_id: normalizedVenueId,
      ...createAvailabilityRefreshAttempt(),
    },
    { headers: SYNC_RESPONSE_HEADERS }
  );
}
