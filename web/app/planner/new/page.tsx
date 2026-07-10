import { PlannerNewForm } from "@/components/PlannerNewForm";
import { venues } from "@/lib/venues";

export const dynamic = "force-dynamic";

function isoDateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function NewPlannerPage() {
  return (
    <PlannerNewForm
      defaultStartDate={isoDateOffset(0)}
      defaultEndDate={isoDateOffset(6)}
      venues={venues.map((venue) => ({
        id: venue.id,
        name: venue.name,
        summary: venue.summary,
      }))}
    />
  );
}
