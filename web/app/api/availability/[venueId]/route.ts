import { getVenueDefinition } from "@/lib/venues";
import { parseAvailabilityRefreshAttempt } from "@/server/availabilityAttempt";
import {
  InvalidAvailabilityPayloadError,
  readAvailabilityPayload,
} from "@/server/availabilityPayload";
import { saveAvailability, getAvailabilityRecord, safeVenueId } from "@/server/availabilityStore";
import { API_RESPONSE_HEADERS, apiPreflight, requireSyncToken } from "@/server/security";

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
    const normalizedVenueId = safeVenueId(venueId);
    if (!getVenueDefinition(normalizedVenueId)) {
      return Response.json({ error: "Unknown venue." }, { status: 400, headers: API_RESPONSE_HEADERS });
    }
    const attempt = parseAvailabilityRefreshAttempt(request.headers);
    if (!attempt) {
      return Response.json(
        { error: "Refresh attempt required. Reload the extension and try again." },
        { status: 409, headers: API_RESPONSE_HEADERS }
      );
    }
    const payload = await readAvailabilityPayload(request, normalizedVenueId);
    const record = await saveAvailability(normalizedVenueId, payload, attempt);
    console.info(
      JSON.stringify({
        event: "availability_sync",
        venue_id: record.venue_id,
        accepted: record.accepted,
        superseded: record.superseded,
      })
    );
    return Response.json(
      {
        ok: true,
        accepted: record.accepted,
        superseded: record.superseded,
        venue_id: record.venue_id,
        received_at: record.received_at,
      },
      { headers: API_RESPONSE_HEADERS }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const invalidInput =
      error instanceof InvalidAvailabilityPayloadError ||
      message.startsWith("Invalid refresh attempt") ||
      message === "Missing venue id.";
    return Response.json(
      { error: invalidInput ? message : "Could not save availability." },
      { status: invalidInput ? 400 : 500, headers: API_RESPONSE_HEADERS }
    );
  }
}

export async function GET(request: Request, { params }: AvailabilityRouteContext) {
  const unauthorized = requireSyncToken(request);
  if (unauthorized) return unauthorized;

  try {
    const { venueId } = await params;
    const normalizedVenueId = safeVenueId(venueId);
    if (!getVenueDefinition(normalizedVenueId)) {
      return Response.json({ error: "Unknown venue." }, { status: 400, headers: API_RESPONSE_HEADERS });
    }
    const record = await getAvailabilityRecord(normalizedVenueId);
    if (!record) {
      return Response.json(
        { error: `No cached availability for ${normalizedVenueId}` },
        { status: 404, headers: API_RESPONSE_HEADERS }
      );
    }
    return Response.json(record, { headers: API_RESPONSE_HEADERS });
  } catch {
    return Response.json(
      { error: "Could not load availability." },
      { status: 500, headers: API_RESPONSE_HEADERS }
    );
  }
}
