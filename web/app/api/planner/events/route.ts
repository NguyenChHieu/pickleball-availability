import { createPlannerEvent } from "@/server/plannerStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const event = await createPlannerEvent(await request.json());
    return Response.json({
      ok: true,
      event,
      href: `/p/${encodeURIComponent(event.eventToken)}`,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not create planner event." },
      { status: 400 }
    );
  }
}
