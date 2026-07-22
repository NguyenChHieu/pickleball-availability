import { DashboardClient } from "@/components/DashboardClient";
import { venues } from "@/lib/venues";
import { getAllPayloads } from "@/server/availabilityStore";
import { buildDashboardVenue } from "@/server/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let payloads = {} as Awaited<ReturnType<typeof getAllPayloads>>;

  try {
    payloads = await getAllPayloads();
  } catch {
    // The dashboard remains useful as a refresh controller while storage is unavailable.
  }

  const now = new Date().toISOString();
  const dashboardVenues = venues.map((venue) => buildDashboardVenue(venue, payloads[venue.id], now));

  return <DashboardClient venues={dashboardVenues} />;
}
