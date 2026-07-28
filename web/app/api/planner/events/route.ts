import { readPlannerRequestJson } from "@/server/plannerRequest";
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
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not create planner event." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
}
