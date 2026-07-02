import { notFound } from "next/navigation";

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

  if (availability.state === "not-found") {
    notFound();
  }

  if (availability.state === "empty") {
    return (
      <main className="route-state">
        <h1>No cached availability yet</h1>
        <p>Refresh ProPickle from the extension, then reopen this page.</p>
        {availability.fallbackUrl ? <a href={availability.fallbackUrl}>Open booking</a> : null}
      </main>
    );
  }

  if (availability.state === "error") {
    return (
      <main className="route-state">
        <h1>{availability.message}</h1>
        <p>Check the link or try the stable fallback page.</p>
      </main>
    );
  }

  return (
    <main className="route-state">
      <p className="text-label">Cached court availability</p>
      <h1>{availability.venueName}</h1>
      <p className="text-muted">
        {availability.freshnessLabel ? `Last read ${availability.freshnessLabel}` : "Cached availability"}
      </p>
      <p>
        {availability.summary.dayCount} day(s), {availability.summary.totalOpenHours} open hour(s)
      </p>
    </main>
  );
}
