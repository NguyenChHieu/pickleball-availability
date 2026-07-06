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
  const scheduleFingerprint = () => {
    const slotIds = Array.from(document.querySelectorAll("[data-test-id^='booking-']"))
      .map((element) => element.getAttribute("data-test-id") || "")
      .join("|");
    const sheetText = normalizeWhitespace(bookingSheet()?.innerText || bookingSheet()?.textContent || "");
    return `${slotIds}::${sheetText}`;
  };

  const scheduleLoadedForDate = (dateIso, previousFingerprint = "") => {
    if (!bookingSheet() || !resources().length) return false;
    if (firstSlotDate() === dateIso) return true;
    return Boolean(previousFingerprint && hashDate() === dateIso && scheduleFingerprint() !== previousFingerprint);
  };

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
    if (scheduleLoadedForDate(dateIso) || (pageDate() === dateIso && canRead())) return true;

    const previousFingerprint = scheduleFingerprint();
    window.location.hash = `?date=${dateIso}&role=guest`;
    await wait(DAY_SETTLE_MS);
    const hashLoaded = await waitUntil(
      () => scheduleLoadedForDate(dateIso, previousFingerprint),
      DAY_LOAD_TIMEOUT_MS
    );
    if (hashLoaded) {
      await wait(DAY_SETTLE_MS);
      return true;
    }

    // Fallback for ClubSpark instances that ignore direct hash changes.
    const nextButton = document.querySelector(".day-nav-btn.tomorrow");
    const currentDate = pageDate();
    if (nextButton && currentDate && addDays(currentDate, 1) === dateIso) {
      const clickedFromFingerprint = scheduleFingerprint();
      nextButton.click();
      const clickedLoaded = await waitUntil(
        () => scheduleLoadedForDate(dateIso, clickedFromFingerprint),
        DAY_LOAD_TIMEOUT_MS
      );
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

  const startMinutesFromTestId = (element) => {
    const parts = (element.getAttribute("data-test-id") || "").split("|");
    return Number(parts[2]);
  };

  const courtNameForSlot = (element) => {
    const resource = element.closest(".resource");
    if (!resource) return "";

    const explicit =
      resource.getAttribute("data-resource-name") ||
      resource.getAttribute("aria-label") ||
      "";

    if (normalizeWhitespace(explicit)) return normalizeWhitespace(explicit);

    const labelled = resource.querySelector(".resource-name, .resource-title, .resource-heading");
    const labelledText = labelled?.innerText || labelled?.textContent || "";
    if (normalizeWhitespace(labelledText)) return normalizeWhitespace(labelledText);

    const heading = Array.from(resource.querySelectorAll("h2, h3, h4, h5, strong")).find((candidate) =>
      normalizeWhitespace(candidate.innerText || candidate.textContent || "")
    );
    return normalizeWhitespace(heading?.innerText || heading?.textContent || "");
  };

  const parseOpenSlot = (element) => {
    const text = normalizeWhitespace(element.innerText || element.textContent || "");
    const testIdStart = startMinutesFromTestId(element);
    const range = text.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    const startMinutes = Number.isFinite(testIdStart)
      ? testIdStart
      : range
        ? timeToMinutes(range[1])
        : null;
    if (startMinutes === null) return null;

    return {
      start_time: range?.[1] || minutesToTime(startMinutes),
      end_time: range?.[2] || minutesToTime(startMinutes + SLOT_MINUTES),
      status: "open",
      court_name: courtNameForSlot(element),
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

  const sameCourtIntervals = (slots) => {
    const byCourt = new Map();
    for (const slot of slots) {
      const courtName = normalizeWhitespace(slot.court_name || slot.resource_name || "");
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

  const extractOpenSlots = () => {
    const slots = [];
    for (const element of Array.from(document.querySelectorAll(".resource a.book-interval.not-booked"))) {
      const slot = parseOpenSlot(element);
      if (slot) slots.push(slot);
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
      const openSlots = extractOpenSlots();
      const openIntervals = mergeOpenIntervals(openSlots);
      const courtIntervals = sameCourtIntervals(openSlots);
      const dayBookingUrl = bookingUrlForDate(currentDateIso, venue);
      results.push({
        source_url: window.location.href,
        title: "Any court",
        date: dateLabel(currentDateIso),
        booking_date: currentDateIso,
        booking_url: dayBookingUrl,
        booking_action_url: dayBookingUrl,
        open_intervals: openIntervals,
        same_court_intervals: courtIntervals,
        remaining_hours: remainingHours(openIntervals),
        raw_slots: openSlots,
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
