import { PlannerNewForm } from "@/components/PlannerNewForm";
import { venues } from "@/lib/venues";

export const dynamic = "force-dynamic";

type NewPlannerPageProps = Readonly<{
  searchParams?: Promise<{
    venues?: string | string[];
    name?: string | string[];
  }>;
}>;

function isoDateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function selectedVenueIds(value: string | string[] | undefined) {
  const requested = firstParam(value)
    .split(",")
    .map((venueId) => venueId.trim())
    .filter(Boolean);
  if (!requested.length) return undefined;

  const validIds = new Set<string>(venues.map((venue) => venue.id));
  const selected = requested.filter((venueId) => validIds.has(venueId));
  return selected.length ? selected : undefined;
}

export default async function NewPlannerPage({ searchParams }: NewPlannerPageProps) {
  const query = (await searchParams) || {};
  const defaultName = firstParam(query.name).trim().slice(0, 80) || undefined;

  return (
    <PlannerNewForm
      defaultStartDate={isoDateOffset(0)}
      defaultEndDate={isoDateOffset(6)}
      defaultName={defaultName}
      selectedVenueIds={selectedVenueIds(query.venues)}
      venues={venues.map((venue) => ({
        id: venue.id,
        name: venue.name,
        summary: venue.summary,
      }))}
    />
  );
}
