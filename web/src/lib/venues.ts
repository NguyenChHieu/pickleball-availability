import { broadwayTheme, northRydeTheme, propickleTheme, type VenueTheme } from "@/lib/themes";

export type VenueDefinition = Readonly<{
  id: string;
  name: string;
  fallbackUrl: string;
  theme: VenueTheme;
}>;

export const venues = [
  {
    id: "propickle",
    name: "ProPickle",
    fallbackUrl: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true",
    theme: propickleTheme,
  },
  {
    id: "broadway",
    name: "Broadway Pickleball",
    fallbackUrl: "https://clubspark.au/Broadway/Booking/BookByDate#?role=guest",
    theme: broadwayTheme,
  },
  {
    id: "northryde",
    name: "North Ryde Pickleball",
    fallbackUrl: "https://www.tennisworldonline.com.au/bookacourt/#bookacourt",
    theme: northRydeTheme,
  },
] as const satisfies readonly VenueDefinition[];

export type ShareVenueLink = VenueDefinition & {
  href: string;
  isCurrent: boolean;
};

export function getVenueDefinition(venueId = "") {
  return venues.find((venue) => venue.id === venueId) || null;
}

export function getVenueTheme(themeId = "") {
  return getVenueDefinition(themeId)?.theme ?? propickleTheme;
}

export function shareVenueLinks(shareToken: string, currentVenueId: string): ShareVenueLink[] {
  if (!shareToken) return [];
  return venues.map((venue) => ({
    ...venue,
    href: shareVenuePath(shareToken, venue.id),
    isCurrent: venue.id === currentVenueId,
  }));
}

export function shareVenuePath(shareToken: string, venueId: string) {
  return `/s/${encodeURIComponent(shareToken)}/${encodeURIComponent(venueId)}`;
}
