import { getVenueDefinition } from "@/lib/venues";
import { parseAvailabilityRefreshReport } from "@/server/availabilityRefresh";
import { safeVenueId, saveAvailabilityRefreshState } from "@/server/availabilityStore";
import { API_CORS_HEADERS, apiPreflight, requireSyncToken } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RefreshStatusRouteContext = Readonly<{
  params: Promise<{ venueId: string }>;
}>;

export function OPTIONS() {
  return apiPreflight();
}

export async function POST(request: Request, { params }: RefreshStatusRouteContext) {
  const unauthorized = requireSyncToken(request);
  if (unauthorized) return unauthorized;

  try {
    const { venueId } = await params;
    const normalizedVenueId = safeVenueId(venueId);
    if (!getVenueDefinition(normalizedVenueId)) {
      return Response.json({ error: "Unknown venue." }, { status: 400, headers: API_CORS_HEADERS });
    }

    const report = parseAvailabilityRefreshReport(await request.json());
    const result = await saveAvailabilityRefreshState(normalizedVenueId, report);
    return Response.json(
      {
        ok: true,
        persisted: result.persisted,
        venue_id: result.state.venue_id,
        attempted_at: result.state.attempted_at,
      },
      { headers: API_CORS_HEADERS }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const invalidInput = error instanceof SyntaxError || message.startsWith("Invalid refresh") || message === "Missing venue id.";
    return Response.json(
      { error: invalidInput ? message : "Could not save refresh status." },
      { status: invalidInput ? 400 : 500, headers: API_CORS_HEADERS }
    );
  }
}
