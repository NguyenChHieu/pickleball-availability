import { AvailabilityPage } from "@/components/AvailabilityPage";
import { fetchPublicAvailability } from "@/lib/publicAvailability";

export const dynamic = "force-dynamic";

type AvailabilityRouteProps = Readonly<{
  params: Promise<{
    shareToken: string;
    venueId: string;
  }>;
}>;

export default async function AvailabilityRoute({ params }: AvailabilityRouteProps) {
  const { shareToken, venueId } = await params;
  const availability = await fetchPublicAvailability(shareToken, venueId);

  return <AvailabilityPage availability={availability} venueId={venueId} />;
}
