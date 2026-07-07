(() => {
  const providerId = "playtomic-availability";
  globalThis.AvailabilityProviders = globalThis.AvailabilityProviders || {};
  if (globalThis.AvailabilityProviders[providerId]) return;

  const DEFAULT_READ_DAYS = 9;
  const DEFAULT_TIMEZONE = "Australia/Sydney";
  const API_URL = "https://playtomic.com/api/clubs/availability";

  const weekdayLong = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const datePartsFormatter = (timeZone) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const localDateIso = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const dateFromIso = (dateIso) => {
    const match = String(dateIso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  };

  const addDays = (dateIso, offset) => {
    const date = dateFromIso(dateIso) || new Date();
    date.setDate(date.getDate() + offset);
    return localDateIso(date);
  };

  const dateLabel = (dateIso) => {
    const date = dateFromIso(dateIso);
    if (!date) return dateIso || "Unknown date";
    return `${weekdayLong[date.getDay()]}, ${monthNames[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")}`;
  };

  const timeToMinutes = (value) => {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) throw new Error(`Unsupported Playtomic time value: ${value}`);
    return Number(match[1]) * 60 + Number(match[2]);
  };

  const minutesToTime = (minutes) => {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const dateTimeInZone = (date, timeZone) => {
    const parts = Object.fromEntries(
      datePartsFormatter(timeZone)
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );
    return {
      dateIso: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
    };
  };

  const resourceName = (venue, resourceId) => {
    const resource = (venue.resources || []).find((candidate) => candidate.id === resourceId);
    return resource?.name || resourceId || "Court";
  };

  const fetchAvailability = async (venue, dateIso) => {
    const url = new URL(API_URL);
    url.searchParams.set("tenant_id", venue.tenantId);
    url.searchParams.set("date", dateIso);
    url.searchParams.set("sport_id", venue.sportId || "PICKLEBALL");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Playtomic availability failed: ${response.status}`);

    const body = await response.json();
    return Array.isArray(body) ? body : [];
  };

  const normalizeSlot = (slot, dayDateIso, resource, venue) => {
    const timeZone = venue.timezone || DEFAULT_TIMEZONE;
    const resourceId = resource?.resource_id || resource?.resourceId || "";
    const duration = Number(slot.duration || slot.duration_minutes || 0);
    if (!slot.start_time || !duration) return null;

    const startUtc = new Date(`${resource.start_date || dayDateIso}T${slot.start_time}Z`);
    if (Number.isNaN(startUtc.getTime())) return null;

    const startLocal = dateTimeInZone(startUtc, timeZone);
    if (startLocal.dateIso !== dayDateIso) return null;

    const endLocal = dateTimeInZone(new Date(startUtc.getTime() + duration * 60 * 1000), timeZone);
    return {
      title: resourceName(venue, resourceId),
      date: dateLabel(dayDateIso),
      start_time: startLocal.time,
      end_time: endLocal.time,
      status: "open",
      price: String(slot.price || ""),
      resource_id: resourceId,
      court_name: resourceName(venue, resourceId),
    };
  };

  const mergeOpenIntervals = (slots) => {
    const intervals = slots
      .filter((slot) => slot.status === "open")
      .map((slot) => ({
        start: timeToMinutes(slot.start_time),
        end: timeToMinutes(slot.end_time),
      }))
      .filter((slot) => slot.end > slot.start)
      .sort((left, right) => left.start - right.start);

    const merged = [];
    for (const interval of intervals) {
      const previous = merged[merged.length - 1];
      if (!previous || interval.start > previous.end) merged.push({ ...interval });
      else previous.end = Math.max(previous.end, interval.end);
    }

    return merged.map((interval) => ({
      start_time: minutesToTime(interval.start),
      end_time: minutesToTime(interval.end),
    }));
  };

  const sameCourtIntervals = (slots) => {
    const byCourt = new Map();
    for (const slot of slots) {
      const courtName = String(slot.court_name || slot.resource_id || "").trim();
      if (!courtName) continue;
      byCourt.set(courtName, [...(byCourt.get(courtName) || []), slot]);
    }

    return Array.from(byCourt.entries())
      .map(([courtName, courtSlots]) => ({
        court_name: courtName,
        intervals: mergeOpenIntervals(courtSlots),
      }))
      .filter((group) => group.intervals.length);
  };

  const remainingHours = (intervals) =>
    intervals.reduce(
      (sum, interval) => sum + (timeToMinutes(interval.end_time) - timeToMinutes(interval.start_time)) / 60,
      0
    );

  const bookingUrlForVenue = (venue = {}) => venue.publicBookingUrl || venue.startUrl || window.location.href;

  const canRead = () => true;
  const setupRequired = () => false;
  const selectDate = async () => true;

  async function readAvailability(venue = {}) {
    if (!venue.tenantId) throw new Error("Playtomic venue is missing tenantId.");

    const readDays = Number(venue.readDays || DEFAULT_READ_DAYS);
    const startDate = localDateIso();
    const bookingUrl = bookingUrlForVenue(venue);
    const days = [];

    for (let offset = 0; offset < readDays; offset += 1) {
      const dateIso = addDays(startDate, offset);
      const resources = await fetchAvailability(venue, dateIso);
      const rawSlots = resources.flatMap((resource) =>
        (Array.isArray(resource.slots) ? resource.slots : [])
          .map((slot) => normalizeSlot(slot, dateIso, resource, venue))
          .filter(Boolean)
      );
      const openIntervals = mergeOpenIntervals(rawSlots);

      days.push({
        source_url: window.location.href,
        title: "Any pickleball court",
        date: dateLabel(dateIso),
        booking_date: dateIso,
        booking_url: bookingUrl,
        booking_action_url: bookingUrl,
        open_intervals: openIntervals,
        same_court_intervals: sameCourtIntervals(rawSlots),
        remaining_hours: remainingHours(openIntervals),
        raw_slots: rawSlots,
      });
    }

    return {
      exported_at: new Date().toISOString(),
      source_url: window.location.href,
      venue_id: venue.id || "sydneyracquet",
      venue_name: venue.name || "Sydney Racquet Club",
      provider_id: providerId,
      booking_url: bookingUrl,
      days,
    };
  }

  globalThis.AvailabilityProviders[providerId] = Object.freeze({
    providerId,
    canRead,
    setupRequired,
    selectDate,
    readAvailability,
  });
})();
