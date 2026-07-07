(() => {
  const PLAYBYPOINT_PROVIDER_ID = "playbypoint-bookbox";
  const CLUBSPARK_PROVIDER_ID = "clubspark-book-by-date";
  const MINDBODY_PROVIDER_ID = "mindbody-appointments";
  const SELECTED_VENUE_KEY = "selectedVenueId";
  const DEFAULT_VENUE_ID = "propickle";
  const BROADWAY_BOOKING_BASE = "https://clubspark.au/Broadway/Booking/BookByDate";
  const NORTH_RYDE_WIDGET_ID = "7b9803fef1";
  const NORTH_RYDE_MINDBODY_BASE = `https://go.mindbodyonline.com/book/widgets/appointments/view/${NORTH_RYDE_WIDGET_ID}`;
  const NORTH_RYDE_PUBLIC_BOOKING_URL = "https://www.tennisworldonline.com.au/bookacourt/#bookacourt";

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
    {
      id: "northryde",
      name: "North Ryde Pickleball",
      providerId: MINDBODY_PROVIDER_ID,
      startUrl: `${NORTH_RYDE_MINDBODY_BASE}/services`,
      publicBookingUrl: NORTH_RYDE_PUBLIC_BOOKING_URL,
      readinessTimeoutMs: 15000,
      readDays: 9,
      cacheFirstReadDays: 7,
      cacheFirstTtlMs: 5 * 60 * 1000,
      readProviders: false,
      deepReadProviders: true,
      retryActiveOnFailure: true,
      maxProviders: 24,
      matchUrls: [`${NORTH_RYDE_MINDBODY_BASE}/*`],
      services: [
        {
          name: "Standard Pickleball",
          serviceButtonId: "asrv_115VZ4iBaZ9TAxVYTx",
          serviceId: "120",
          slotMinutes: 30,
          price: "A$12.50",
        },
        {
          name: "Premium Pickleball",
          serviceButtonId: "asrv_115VZ4iBaZ9TAxVYf9",
          serviceId: "132",
          slotMinutes: 30,
          price: "A$15.00",
        },
      ],
    },
  ];

  const copyVenue = (venue) => ({
    ...venue,
    matchUrls: [...venue.matchUrls],
    services: venue.services?.map((service) => ({ ...service })),
  });
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
    MINDBODY_PROVIDER_ID,
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
