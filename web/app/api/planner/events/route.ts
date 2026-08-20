import { clientRateLimitKey, InvalidPlannerRequestError, readPlannerRequestJson } from "@/server/plannerRequest";
import { createPlannerEvent, PlannerEventCreationRateLimitError } from "@/server/plannerStore";
import { NO_STORE_HEADERS } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readPlannerRequestJson(request);
    const event = await createPlannerEvent(body, clientRateLimitKey(request));
    return Response.json(
      {
        ok: true,
        event,
        href: `/p/${encodeURIComponent(event.eventToken)}`,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    if (error instanceof PlannerEventCreationRateLimitError) {
      const headers = new Headers(NO_STORE_HEADERS);
      if (error.retryAfterSeconds > 0) headers.set("retry-after", String(error.retryAfterSeconds));
      return Response.json({ error: error.message }, { status: 429, headers });
    }
    if (error instanceof InvalidPlannerRequestError) {
      return Response.json({ error: error.message }, { status: 400, headers: NO_STORE_HEADERS });
    }
    console.error("Could not create planner event.", error);
    return Response.json(
      { error: "Could not create planner event." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
