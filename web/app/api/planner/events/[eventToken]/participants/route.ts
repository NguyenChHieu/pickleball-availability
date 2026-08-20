import { InvalidPlannerRequestError, readPlannerRequestJson } from "@/server/plannerRequest";
import {
  getPlannerEventView,
  PlannerRecoveryRateLimitError,
  upsertPlannerParticipant,
} from "@/server/plannerStore";
import { NO_STORE_HEADERS } from "@/server/security";

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
    const participant = await upsertPlannerParticipant(eventToken, await readPlannerRequestJson(request));
    if (!participant) {
      return Response.json({ error: "Not found" }, { status: 404, headers: NO_STORE_HEADERS });
    }

    const view = await getPlannerEventView(eventToken);
    return Response.json(
      {
        ok: true,
        participant: {
          participantId: participant.participantId,
          displayName: participant.displayName,
          editToken: participant.editToken,
        },
        view,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    if (error instanceof PlannerRecoveryRateLimitError) {
      return Response.json({ error: error.message }, { status: 429, headers: NO_STORE_HEADERS });
    }
    if (error instanceof InvalidPlannerRequestError) {
      return Response.json({ error: error.message }, { status: 400, headers: NO_STORE_HEADERS });
    }
    console.error("Could not save planner participant.", error);
    return Response.json(
      { error: "Could not save availability." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
