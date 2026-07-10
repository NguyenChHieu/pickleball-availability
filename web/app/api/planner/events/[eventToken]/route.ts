import { getPlannerEventView } from "@/server/plannerStore";

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
    if (!view) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(view);
  } catch {
    return Response.json({ error: "Could not load planner event." }, { status: 500 });
  }
}
