import {
  broadwayTheme,
  houseOfPickleTheme,
  northRydeTheme,
  propickleTheme,
  sydneyRacquetTheme,
  wotsoTheme,
  type VenueTheme,
} from "./themes.ts";

export type VenueDefinition = Readonly<{
  id: string;
  name: string;
  platform: string;
  summary: string;
  fallbackUrl: string;
  allowedHosts: readonly string[];
  theme: VenueTheme;
}>;

export const venues = [
  {
    id: "propickle",
    name: "ProPickle",
    platform: "Playbypoint",
    summary: "Playbypoint reader with login-aware setup handling and day booking shortcuts.",
    fallbackUrl: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true",
    allowedHosts: ["book.propickle.com.au"],
    theme: propickleTheme,
  },
  {
    id: "broadway",
    name: "Broadway Pickleball",
    platform: "ClubSpark",
    summary: "ClubSpark guest availability reader with venue-specific share page styling.",
    fallbackUrl: "https://clubspark.au/Broadway/Booking/BookByDate#?role=guest",
    allowedHosts: ["clubspark.au"],
    theme: broadwayTheme,
  },
  {
    id: "northryde",
    name: "North Ryde Pickleball",
    platform: "Mindbody",
    summary: "Mindbody reader with fast refresh by default and optional same-court deep scan.",
    fallbackUrl: "https://www.tennisworldonline.com.au/bookacourt/#bookacourt",
    allowedHosts: ["go.mindbodyonline.com", "www.tennisworldonline.com.au"],
    theme: northRydeTheme,
  },
  {
    id: "sydneyracquet",
    name: "Sydney Racquet Club",
    platform: "Playtomic",
    summary: "Mixed padel/pickleball Playtomic venue; this reader uses the pickleball sport feed only.",
    fallbackUrl: "https://playtomic.com/clubs/sydney-racquet-club?sport_id=PICKLEBALL",
    allowedHosts: ["playtomic.com"],
    theme: sydneyRacquetTheme,
  },
  {
    id: "houseofpickle-darlingharbour",
    name: "House of Pickle DH",
    platform: "PodPlay",
    summary: "PodPlay DOM reader for visible guest booking rows, preserving exposed court labels where available.",
    fallbackUrl: "https://houseofpickle.podplay.app/book/darling-harbour?pod=darling-harbour-pickleball-courts",
    allowedHosts: ["houseofpickle.podplay.app"],
    theme: houseOfPickleTheme,
  },
  {
    id: "wotso-pyrmont",
    name: "WOTSO Pickleball Pyrmont",
    platform: "Hamlet",
    summary: "Hamlet reader uses the page guest session, then subtracts bookings from court open hours.",
    fallbackUrl: "https://wotso.hamletapp.co/shop/experience/pyrmont",
    allowedHosts: ["wotso.hamletapp.co"],
    theme: wotsoTheme,
  },
] as const satisfies readonly VenueDefinition[];

export type ShareVenueLink = Pick<VenueDefinition, "id" | "name" | "summary"> & {
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
    href: shareVenuePath(shareToken, venue.id),
    id: venue.id,
    isCurrent: venue.id === currentVenueId,
    name: venue.name,
    summary: venue.summary,
  }));
}

export function shareVenuePath(shareToken: string, venueId: string) {
  return `/s/${encodeURIComponent(shareToken)}/${encodeURIComponent(venueId)}`;
}
