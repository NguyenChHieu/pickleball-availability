import { getAvailabilityPayload } from "@/server/availabilityStore";
import { formatAvailability } from "@/server/formatAvailability";
import { API_CORS_HEADERS, apiPreflight, requireSyncToken } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SummaryRouteContext = Readonly<{
  params: Promise<{
    venueId: string;
  }>;
}>;

export function OPTIONS() {
  return apiPreflight();
}

export async function GET(request: Request, { params }: SummaryRouteContext) {
  const unauthorized = requireSyncToken(request);
  if (unauthorized) return unauthorized;

  try {
    const { venueId } = await params;
    const payload = await getAvailabilityPayload(venueId);
    return new Response(formatAvailability(payload), {
      status: payload ? 200 : 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        ...API_CORS_HEADERS,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: API_CORS_HEADERS }
    );
  }
}
