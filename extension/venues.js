(() => {
  const PLAYBYPOINT_PROVIDER_ID = "playbypoint-bookbox";
  const CLUBSPARK_PROVIDER_ID = "clubspark-book-by-date";
  const SELECTED_VENUE_KEY = "selectedVenueId";
  const DEFAULT_VENUE_ID = "propickle";
  const BROADWAY_BOOKING_BASE = "https://clubspark.au/Broadway/Booking/BookByDate";

  const localDateIso = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const broadwayBookingUrl = (dateIso = localDateIso()) =>
    `${BROADWAY_BOOKING_BASE}#?date=${encodeURIComponent(dateIso)}&role=guest`;

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
    {
      id: "broadway",
      name: "Broadway Pickleball",
      providerId: CLUBSPARK_PROVIDER_ID,
      startUrl: broadwayBookingUrl(),
      bookingUrlBase: BROADWAY_BOOKING_BASE,
      readinessTimeoutMs: 10000,
      readDays: 9,
      matchUrls: ["https://clubspark.au/Broadway/*"],
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
    CLUBSPARK_PROVIDER_ID,
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
