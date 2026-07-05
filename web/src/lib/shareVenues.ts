export const shareVenues = [
  {
    id: "propickle",
    name: "ProPickle",
    shortName: "ProPickle",
  },
  {
    id: "broadway",
    name: "Broadway Pickleball",
    shortName: "Broadway",
  },
] as const;

export type ShareVenue = (typeof shareVenues)[number];
export type ShareVenueLink = ShareVenue & {
  href: string;
  isCurrent: boolean;
};

export function shareVenueLinks(shareToken: string, currentVenueId: string): ShareVenueLink[] {
  if (!shareToken) return [];
  return shareVenues.map((venue) => ({
    ...venue,
    href: shareVenuePath(shareToken, venue.id),
    isCurrent: venue.id === currentVenueId,
  }));
}

export function shareVenuePath(shareToken: string, venueId: string) {
  return `/s/${encodeURIComponent(shareToken)}/${encodeURIComponent(venueId)}`;
}
