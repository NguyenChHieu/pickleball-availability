import {
  getPlannerEventView,
  PlannerRecoveryRateLimitError,
  upsertPlannerParticipant,
} from "@/server/plannerStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlannerParticipantRouteContext = Readonly<{
  params: Promise<{
    eventToken: string;
  }>;
}>;

export async function POST(request: Request, { params }: PlannerParticipantRouteContext) {
  try {
    const { eventToken } = await params;
    const participant = await upsertPlannerParticipant(eventToken, await request.json());
    if (!participant) return Response.json({ error: "Not found" }, { status: 404 });

    const view = await getPlannerEventView(eventToken);
    return Response.json({
      ok: true,
      participant: {
        participantId: participant.participantId,
        displayName: participant.displayName,
        editToken: participant.editToken,
      },
      view,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save availability." },
      { status: error instanceof PlannerRecoveryRateLimitError ? 429 : 400 }
    );
  }
}
