import { PlannerEventClient } from "@/components/PlannerEventClient";
import { getPlannerEventView } from "@/server/plannerStore";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false, nocache: true },
};

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
