import { getAvailabilityPayload } from "@/server/availabilityStore";
import { formatAvailability } from "@/server/formatAvailability";
import { notFoundJson, validShareToken } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShareTextRouteContext = Readonly<{
  params: Promise<{
    shareToken: string;
    venueId: string;
  }>;
}>;

export async function GET(_request: Request, { params }: ShareTextRouteContext) {
  const { shareToken, venueId } = await params;
  if (!validShareToken(shareToken)) return notFoundJson();

  const payload = await getAvailabilityPayload(venueId);
  return new Response(formatAvailability(payload), {
    status: payload ? 200 : 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
