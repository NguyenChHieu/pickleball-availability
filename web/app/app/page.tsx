import { DashboardClient } from "@/components/DashboardClient";
import { venues } from "@/lib/venues";
import { getAllAvailabilityRecords, getAllAvailabilityRefreshStates } from "@/server/availabilityStore";
import { buildDashboardVenue } from "@/server/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let records = {} as Awaited<ReturnType<typeof getAllAvailabilityRecords>>;
  let refreshStates = {} as Awaited<ReturnType<typeof getAllAvailabilityRefreshStates>>;

  try {
    records = await getAllAvailabilityRecords();
  } catch {
    // The dashboard remains useful as a refresh controller while storage is unavailable.
  }

  try {
    refreshStates = await getAllAvailabilityRefreshStates();
  } catch {
    // Refresh metadata is optional; cached payloads remain the source of availability truth.
  }

  const now = new Date().toISOString();
  const dashboardVenues = venues.map((venue) =>
    buildDashboardVenue(
      venue,
      records[venue.id]?.payload,
      now,
      refreshStates[venue.id],
      records[venue.id]?.received_at
    )
  );

  return <DashboardClient venues={dashboardVenues} />;
}
