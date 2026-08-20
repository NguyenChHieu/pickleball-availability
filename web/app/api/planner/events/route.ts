import { InvalidPlannerRequestError, readPlannerRequestJson } from "@/server/plannerRequest";
import { createPlannerEvent } from "@/server/plannerStore";
import { NO_STORE_HEADERS } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const event = await createPlannerEvent(await readPlannerRequestJson(request));
    return Response.json(
      {
        ok: true,
        event,
        href: `/p/${encodeURIComponent(event.eventToken)}`,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
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
