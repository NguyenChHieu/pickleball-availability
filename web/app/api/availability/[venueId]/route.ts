import { parseAvailabilityRefreshAttempt } from "@/server/availabilityAttempt";
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
    const attempt = parseAvailabilityRefreshAttempt(request.headers);
    if (!attempt) {
      return Response.json(
        { error: "Refresh attempt required. Reload the extension and try again." },
        { status: 409, headers: API_CORS_HEADERS }
      );
    }
    const payload = await request.json();
    const record = await saveAvailability(venueId, payload, attempt);
    return Response.json(
      {
        ok: true,
        accepted: record.accepted,
        superseded: record.superseded,
        venue_id: record.venue_id,
        received_at: record.received_at,
      },
      { headers: API_CORS_HEADERS }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const invalidInput = message.startsWith("Invalid refresh attempt");
    return Response.json(
      { error: invalidInput ? message : "Could not save availability." },
      { status: invalidInput ? 400 : 500, headers: API_CORS_HEADERS }
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
