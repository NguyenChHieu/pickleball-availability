import { PlannerEventClient } from "@/components/PlannerEventClient";
import { getPlannerEventView } from "@/server/plannerStore";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlannerPageProps = Readonly<{
  params: Promise<{
    eventToken: string;
  }>;
}>;

export default async function PlannerPage({ params }: PlannerPageProps) {
  const { eventToken } = await params;
  const view = await getPlannerEventView(eventToken);
  if (!view) notFound();

  return <PlannerEventClient initialView={view} />;
}
