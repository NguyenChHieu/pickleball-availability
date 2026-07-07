(() => {
  const PLAYBYPOINT_PROVIDER_ID = "playbypoint-bookbox";
  const CLUBSPARK_PROVIDER_ID = "clubspark-book-by-date";
  const MINDBODY_PROVIDER_ID = "mindbody-appointments";
  const PLAYTOMIC_PROVIDER_ID = "playtomic-availability";
  const PODPLAY_PROVIDER_ID = "podplay-dom";
  const SELECTED_VENUE_KEY = "selectedVenueId";
  const DEFAULT_VENUE_ID = "propickle";
  const BROADWAY_BOOKING_BASE = "https://clubspark.au/Broadway/Booking/BookByDate";
  const NORTH_RYDE_WIDGET_ID = "7b9803fef1";
  const NORTH_RYDE_MINDBODY_BASE = `https://go.mindbodyonline.com/book/widgets/appointments/view/${NORTH_RYDE_WIDGET_ID}`;
  const NORTH_RYDE_PUBLIC_BOOKING_URL = "https://www.tennisworldonline.com.au/bookacourt/#bookacourt";
  const HOUSE_OF_PICKLE_BOOKING_URL =
    "https://houseofpickle.podplay.app/book/darling-harbour?pod=darling-harbour-pickleball-courts";

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
    {
      id: "sydneyracquet",
      name: "Sydney Racquet Club",
      providerId: PLAYTOMIC_PROVIDER_ID,
      startUrl: "https://playtomic.com/clubs/sydney-racquet-club?sport_id=PICKLEBALL",
      publicBookingUrl: "https://playtomic.com/clubs/sydney-racquet-club?sport_id=PICKLEBALL",
      tenantId: "5dba6f31-06fd-4d3a-8238-1be3032bac7c",
      sportId: "PICKLEBALL",
      timezone: "Australia/Sydney",
      readinessTimeoutMs: 10000,
      readDays: 9,
      matchUrls: ["https://playtomic.com/clubs/sydney-racquet-club*"],
      resources: [
        { id: "0badb1b1-d6c4-4c2d-bdf4-1dad54d43c68", name: "Pickle 3" },
        { id: "2510010b-6149-4a78-ac41-a9f4c120dc05", name: "Pickle 4" },
        { id: "2884798c-c79a-4af2-9b82-cdd1102b2f7e", name: "Pickle 6" },
        { id: "dc7300ee-7d6d-413a-8d89-a326ed8122b9", name: "Pickle 7" },
        { id: "a9a1064b-dc16-494e-8d8b-a9ac3df51521", name: "Pickle 8" },
      ],
    },
    {
      id: "houseofpickle-darlingharbour",
      name: "House of Pickle Darling Harbour",
      providerId: PODPLAY_PROVIDER_ID,
      startUrl: HOUSE_OF_PICKLE_BOOKING_URL,
      publicBookingUrl: HOUSE_OF_PICKLE_BOOKING_URL,
      readinessTimeoutMs: 15000,
      readDays: 1,
      slotMinutes: 30,
      tenantId: "houseofpickle",
      areaSlug: "darling-harbour",
      areaId: "c8eaef5c-c83e-4ac9-84c2-d64a7d570da8",
      podSlug: "darling-harbour-pickleball-courts",
      podId: "582a1846-0a56-414d-99a5-bcccc310a4e7",
      matchUrls: ["https://houseofpickle.podplay.app/book/darling-harbour*"],
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
    PLAYTOMIC_PROVIDER_ID,
    PODPLAY_PROVIDER_ID,
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
