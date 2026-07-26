import { getPlannerEventView } from "@/server/plannerStore";
import { NO_STORE_HEADERS } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlannerEventRouteContext = Readonly<{
  params: Promise<{
    eventToken: string;
  }>;
}>;

export async function GET(_request: Request, { params }: PlannerEventRouteContext) {
  try {
    const { eventToken } = await params;
    const view = await getPlannerEventView(eventToken);
    if (!view) return Response.json({ error: "Not found" }, { status: 404, headers: NO_STORE_HEADERS });
    return Response.json(view, { headers: NO_STORE_HEADERS });
  } catch {
    return Response.json(
      { error: "Could not load planner event." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
