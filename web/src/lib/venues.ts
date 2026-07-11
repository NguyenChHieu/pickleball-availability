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
  summary: string;
  fallbackUrl: string;
  theme: VenueTheme;
}>;

export const venues = [
  {
    id: "propickle",
    name: "ProPickle",
    summary: "Playbypoint reader with login-aware setup handling and day booking shortcuts.",
    fallbackUrl: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true",
    theme: propickleTheme,
  },
  {
    id: "broadway",
    name: "Broadway Pickleball",
    summary: "ClubSpark guest availability reader with venue-specific share page styling.",
    fallbackUrl: "https://clubspark.au/Broadway/Booking/BookByDate#?role=guest",
    theme: broadwayTheme,
  },
  {
    id: "northryde",
    name: "North Ryde Pickleball",
    summary: "Mindbody reader with fast refresh by default and optional same-court deep scan.",
    fallbackUrl: "https://www.tennisworldonline.com.au/bookacourt/#bookacourt",
    theme: northRydeTheme,
  },
  {
    id: "sydneyracquet",
    name: "Sydney Racquet Club",
    summary: "Mixed padel/pickleball Playtomic venue; this reader uses the pickleball sport feed only.",
    fallbackUrl: "https://playtomic.com/clubs/sydney-racquet-club?sport_id=PICKLEBALL",
    theme: sydneyRacquetTheme,
  },
  {
    id: "houseofpickle-darlingharbour",
    name: "House of Pickle DH",
    summary: "PodPlay DOM reader for visible guest booking rows, preserving exposed court labels where available.",
    fallbackUrl: "https://houseofpickle.podplay.app/book/darling-harbour?pod=darling-harbour-pickleball-courts",
    theme: houseOfPickleTheme,
  },
  {
    id: "wotso-pyrmont",
    name: "WOTSO Pickleball Pyrmont",
    summary: "Hamlet reader uses the page guest session, then subtracts bookings from court open hours.",
    fallbackUrl: "https://wotso.hamletapp.co/shop/experience/pyrmont",
    theme: wotsoTheme,
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
