(() => {
  const PLAYBYPOINT_PROVIDER_ID = "playbypoint-bookbox";
  const SELECTED_VENUE_KEY = "selectedVenueId";
  const DEFAULT_VENUE_ID = "propickle";

  const venues = Object.freeze([
    Object.freeze({
      id: "propickle",
      name: "ProPickle",
      providerId: PLAYBYPOINT_PROVIDER_ID,
      startUrl: "https://book.propickle.com.au/f/ProPickle/booking_waiver",
      matchUrls: Object.freeze(["https://book.propickle.com.au/*"]),
    }),
  ]);

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const venuePayloadKey = (venueId) => `availability:venue:${venueId}`;

  const wildcardToRegExp = (pattern) =>
    new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);

  const matchesPattern = (url, pattern) => wildcardToRegExp(pattern).test(url || "");

  const getVenues = () => clone(venues);
  const getVenue = (venueId) => venues.find((venue) => venue.id === venueId) || venues[0];

  const findVenueForUrl = (url) =>
    venues.find((venue) => venue.matchUrls.some((pattern) => matchesPattern(url, pattern))) || null;

  globalThis.AvailabilityRegistry = Object.freeze({
    PLAYBYPOINT_PROVIDER_ID,
    SELECTED_VENUE_KEY,
    DEFAULT_VENUE_ID,
    getVenues,
    getVenue: (venueId) => clone(getVenue(venueId)),
    findVenueForUrl: (url) => {
      const venue = findVenueForUrl(url);
      return venue ? clone(venue) : null;
    },
    venuePayloadKey,
  });
})();
