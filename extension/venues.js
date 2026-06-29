(() => {
  const PLAYBYPOINT_PROVIDER_ID = "playbypoint-bookbox";
  const SELECTED_VENUE_KEY = "selectedVenueId";
  const DEFAULT_VENUE_ID = "propickle";

  const venues = [
    {
      id: "propickle",
      name: "ProPickle",
      providerId: PLAYBYPOINT_PROVIDER_ID,
      startUrl: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true",
      setupUrl: "https://book.propickle.com.au/f/ProPickle/booking_waiver",
      readinessTimeoutMs: 10000,
      matchUrls: ["https://book.propickle.com.au/*"],
    },
  ];

  const copyVenue = (venue) => ({ ...venue, matchUrls: [...venue.matchUrls] });
  const venuePayloadKey = (venueId) => `availability:venue:${venueId}`;

  const wildcardToRegExp = (pattern) =>
    new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);

  const matchesPattern = (url, pattern) => wildcardToRegExp(pattern).test(url || "");

  const getVenues = () => venues.map(copyVenue);
  const getVenue = (venueId) => venues.find((venue) => venue.id === venueId) || venues[0];

  const findVenueForUrl = (url) =>
    venues.find((venue) => venue.matchUrls.some((pattern) => matchesPattern(url, pattern))) || null;

  globalThis.AvailabilityRegistry = Object.freeze({
    PLAYBYPOINT_PROVIDER_ID,
    SELECTED_VENUE_KEY,
    DEFAULT_VENUE_ID,
    getVenues,
    getVenue: (venueId) => copyVenue(getVenue(venueId)),
    findVenueForUrl: (url) => {
      const venue = findVenueForUrl(url);
      return venue ? copyVenue(venue) : null;
    },
    venuePayloadKey,
  });
})();
