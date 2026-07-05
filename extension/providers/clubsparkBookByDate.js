(() => {
  const providerId = "clubspark-book-by-date";
  globalThis.AvailabilityProviders = globalThis.AvailabilityProviders || {};
  if (globalThis.AvailabilityProviders[providerId]) return;

  const DEFAULT_READ_DAYS = 9;
  const DAY_LOAD_TIMEOUT_MS = 7000;
  const DAY_SETTLE_MS = 700;
  const SLOT_MINUTES = 30;

  const normalizeWhitespace = (value) => (value || "").replace(/\s+/g, " ").trim();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
  const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const bookingSheet = () => document.querySelector(".booking-sheet-page, .booking-sheet");
  const resources = () => Array.from(document.querySelectorAll(".resource"));

  const waitUntil = async (predicate, timeoutMs, intervalMs = 150) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return true;
      await wait(intervalMs);
    }
    return predicate();
  };

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
    return `${weekdayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")}`;
  };

  const hashDate = () => {
    const hash = window.location.hash.replace(/^#\??/, "");
    return new URLSearchParams(hash).get("date") || "";
  };

  const firstSlotDate = () => {
    const testId = document.querySelector("[data-test-id^='booking-']")?.getAttribute("data-test-id") || "";
    return testId.split("|")[1] || "";
  };

  const pageDate = () => firstSlotDate() || hashDate();

  const bookingBase = (venue = {}) => {
    if (venue.bookingUrlBase) return String(venue.bookingUrlBase).replace(/\/+$/, "");
    const url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "");
  };

  const bookingUrlForDate = (dateIso, venue = {}) =>
    `${bookingBase(venue)}#?date=${encodeURIComponent(dateIso)}&role=guest`;

  const loadDate = async (dateIso, venue = {}) => {
    if (pageDate() === dateIso && canRead()) return true;

    window.location.hash = `?date=${dateIso}&role=guest`;
    await wait(250);
    const hashLoaded = await waitUntil(() => pageDate() === dateIso && canRead(), DAY_LOAD_TIMEOUT_MS);
    if (hashLoaded) {
      await wait(DAY_SETTLE_MS);
      return true;
    }

    // Fallback for ClubSpark instances that ignore direct hash changes.
    const nextButton = document.querySelector(".day-nav-btn.tomorrow");
    const currentDate = pageDate();
    if (nextButton && currentDate && addDays(currentDate, 1) === dateIso) {
      nextButton.click();
      const clickedLoaded = await waitUntil(() => pageDate() === dateIso && canRead(), DAY_LOAD_TIMEOUT_MS);
      if (clickedLoaded) {
        await wait(DAY_SETTLE_MS);
        return true;
      }
    }

    return false;
  };

  const timeToMinutes = (value) => {
    const match = normalizeWhitespace(value).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) throw new Error(`Unsupported ClubSpark time value: ${value}`);
    return Number(match[1]) * 60 + Number(match[2]);
  };

  const minutesToTime = (minutes) => {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const parseDataTestId = (element) => {
    const parts = (element.getAttribute("data-test-id") || "").split("|");
    return {
      resourceId: parts[0]?.replace(/^booking-/, "") || "",
      dateIso: parts[1] || "",
      startMinutes: Number(parts[2]),
    };
  };

  const parseOpenSlot = (element, courtName, dateIso, venue) => {
    const text = normalizeWhitespace(element.innerText || element.textContent || "");
    const testId = parseDataTestId(element);
    const range = text.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    const price = text.match(/\$\d+(?:\.\d{2})?/)?.[0] || "";
    const startMinutes = Number.isFinite(testId.startMinutes)
      ? testId.startMinutes
      : range
        ? timeToMinutes(range[1])
        : null;
    if (startMinutes === null) return null;

    return {
      title: courtName,
      date: dateLabel(dateIso),
      start_time: range?.[1] || minutesToTime(startMinutes),
      end_time: range?.[2] || minutesToTime(startMinutes + SLOT_MINUTES),
      status: "open",
      price,
      court_name: courtName,
      resource_id: testId.resourceId,
      booking_url: bookingUrlForDate(dateIso, venue),
      booking_action_url: bookingUrlForDate(dateIso, venue),
      source_url: window.location.href,
    };
  };

  const parseBookedSlot = (element, courtName, dateIso, venue) => {
    const text = normalizeWhitespace(element.innerText || element.textContent || "");
    const range = text.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!range) return null;
    const testId = parseDataTestId(element);
    return {
      title: courtName,
      date: dateLabel(dateIso),
      start_time: range[1],
      end_time: range[2],
      status: "full",
      court_name: courtName,
      resource_id: testId.resourceId,
      booking_url: bookingUrlForDate(dateIso, venue),
      source_url: window.location.href,
    };
  };

  const courtNameForResource = (resource) => {
    const header = resource.querySelector(".resource-header");
    if (!header) return "Court";
    const info = normalizeWhitespace(header.querySelector(".resource-info")?.innerText || "");
    const fullText = normalizeWhitespace(header.innerText || header.textContent || "");
    return normalizeWhitespace(fullText.replace(info, "")) || fullText.split(" Full,")[0] || "Court";
  };

  const mergeOpenIntervals = (slots) => {
    const intervals = slots
      .filter((slot) => slot.status === "open")
      .map((slot) => ({
        start: timeToMinutes(slot.start_time),
        end: timeToMinutes(slot.end_time),
      }))
      .filter((slot) => slot.end > slot.start)
      .sort((a, b) => a.start - b.start);

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

  const remainingHours = (intervals) =>
    intervals.reduce(
      (sum, interval) => sum + (timeToMinutes(interval.end_time) - timeToMinutes(interval.start_time)) / 60,
      0
    );

  const extractSlotsForDate = (dateIso, venue) => {
    const slots = [];
    for (const resource of resources()) {
      const courtName = courtNameForResource(resource);
      for (const element of Array.from(resource.querySelectorAll("a.book-interval.not-booked"))) {
        const slot = parseOpenSlot(element, courtName, dateIso, venue);
        if (slot) slots.push(slot);
      }
      for (const element of Array.from(resource.querySelectorAll("a.edit-booking"))) {
        const slot = parseBookedSlot(element, courtName, dateIso, venue);
        if (slot) slots.push(slot);
      }
    }
    return slots;
  };

  const canRead = () => Boolean(bookingSheet() && resources().length && pageDate());
  const setupRequired = () => false;

  async function selectDate(targetDate, venue = {}) {
    const isoMatch = String(targetDate || "").match(/\d{4}-\d{2}-\d{2}/);
    const dateIso = isoMatch?.[0] || hashDate() || firstSlotDate();
    return dateIso ? loadDate(dateIso, venue) : false;
  }

  async function readAvailability(venue = {}) {
    const startDate = hashDate() || firstSlotDate() || localDateIso();
    const readDays = Number(venue.readDays || DEFAULT_READ_DAYS);
    const results = [];

    for (let offset = 0; offset < readDays; offset += 1) {
      const dateIso = addDays(startDate, offset);
      const loaded = await loadDate(dateIso, venue);
      if (!loaded) {
        throw new Error(`Opened ${dateIso}; wait for the ClubSpark schedule to load, then use Read Current Page.`);
      }

      const currentDateIso = pageDate() || dateIso;
      const rawSlots = extractSlotsForDate(currentDateIso, venue);
      const openIntervals = mergeOpenIntervals(rawSlots);
      const dayBookingUrl = bookingUrlForDate(currentDateIso, venue);
      results.push({
        source_url: window.location.href,
        title: "Any court",
        date: dateLabel(currentDateIso),
        booking_date: currentDateIso,
        booking_url: dayBookingUrl,
        booking_action_url: dayBookingUrl,
        open_intervals: openIntervals,
        remaining_hours: remainingHours(openIntervals),
        raw_slots: rawSlots,
      });
    }

    return {
      exported_at: new Date().toISOString(),
      source_url: window.location.href,
      venue_id: venue.id || "broadway",
      venue_name: venue.name || "Broadway Pickleball",
      provider_id: providerId,
      booking_url: bookingUrlForDate(startDate, venue),
      days: results,
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
