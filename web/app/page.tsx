import { HomeLanding } from "@/components/HomeLanding";
import { venues } from "@/lib/venues";
import { getAllPayloads } from "@/server/availabilityStore";
import { STALE_THRESHOLD_MINUTES } from "@/server/publicAvailability";

export const dynamic = "force-dynamic";

const STALE_THRESHOLD_MS = STALE_THRESHOLD_MINUTES * 60 * 1000;

function ageLabel(value: string) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";

  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

async function venueFreshness() {
  try {
    const payloads = await getAllPayloads();
    return venues.map((venue) => {
      const payload = payloads[venue.id];
      const readAt = payload?.exported_at || "";
      const readTime = new Date(readAt).getTime();
      const hasReadTime = Number.isFinite(readTime);
      const dayCount = Array.isArray(payload?.days) ? payload.days.length : 0;
      const stale = hasReadTime && Date.now() - readTime > STALE_THRESHOLD_MS;
      const age = ageLabel(readAt);

      if (!payload) {
        return {
          id: venue.id,
          label: "No cache",
          detail: "Refresh from extension",
          status: "empty" as const,
        };
      }

      return {
        id: venue.id,
        label: stale ? "Stale cache" : "Fresh cache",
        detail: `${dayCount || "No"} day${dayCount === 1 ? "" : "s"}${age ? ` · ${age}` : ""}`,
        status: stale ? ("stale" as const) : ("fresh" as const),
      };
    });
  } catch {
    return venues.map((venue) => ({
      id: venue.id,
      label: "Cache status off",
      detail: "Availability pages still work with share links",
      status: "empty" as const,
    }));
  }
}

export default async function HomePage() {
  return (
    <HomeLanding
      featuredSharePath={process.env.NEXT_PUBLIC_FEATURED_SHARE_PATH}
      venueFreshness={await venueFreshness()}
    />
  );
}
