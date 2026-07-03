import { saveAvailability, getAvailabilityRecord } from "@/server/availabilityStore";
import { API_CORS_HEADERS, apiPreflight, requireSyncToken } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AvailabilityRouteContext = Readonly<{
  params: Promise<{
    venueId: string;
  }>;
}>;

export function OPTIONS() {
  return apiPreflight();
}

export async function POST(request: Request, { params }: AvailabilityRouteContext) {
  const unauthorized = requireSyncToken(request);
  if (unauthorized) return unauthorized;

  try {
    const { venueId } = await params;
    const payload = await request.json();
    const record = await saveAvailability(venueId, payload);
    return Response.json(
      {
        ok: true,
        venue_id: record.venue_id,
        received_at: record.received_at,
      },
      { headers: API_CORS_HEADERS }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: API_CORS_HEADERS }
    );
  }
}

export async function GET(request: Request, { params }: AvailabilityRouteContext) {
  const unauthorized = requireSyncToken(request);
  if (unauthorized) return unauthorized;

  try {
    const { venueId } = await params;
    const record = await getAvailabilityRecord(venueId);
    if (!record) {
      return Response.json(
        { error: `No cached availability for ${venueId}` },
        { status: 404, headers: API_CORS_HEADERS }
      );
    }
    return Response.json(record, { headers: API_CORS_HEADERS });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: API_CORS_HEADERS }
    );
  }
}
