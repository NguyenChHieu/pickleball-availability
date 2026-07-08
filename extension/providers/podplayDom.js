(() => {
  const providerId = "podplay-dom";
  globalThis.AvailabilityProviders = globalThis.AvailabilityProviders || {};
  if (globalThis.AvailabilityProviders[providerId]) return;

  const DEFAULT_SLOT_MINUTES = 30;
  const DEFAULT_READ_DAYS = 1;

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

  const normalizeWhitespace = (value) => (value || "").replace(/\s+/g, " ").trim();
  const bodyText = () => normalizeWhitespace(document.body?.innerText || document.body?.textContent || "");
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitUntil = async (predicate, timeoutMs = 5000, intervalMs = 150) => {
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

  const addDays = (date, days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };

  const dateFromIso = (dateIso) => {
    const match = String(dateIso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  };

  const dateLabel = (dateIso) => {
    const date = dateFromIso(dateIso);
    if (!date) return dateIso || "Unknown date";
    return `${weekdayLong[date.getDay()]}, ${monthNames[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")}`;
  };

  const timeToMinutes = (value) => {
    const time = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!time) throw new Error(`Unsupported PodPlay time value: ${value}`);
    return Number(time[1]) * 60 + Number(time[2]);
  };

  const minutesToTime = (minutes) => {
    const wrapped = ((minutes % 1440) + 1440) % 1440;
    const hour = Math.floor(wrapped / 60);
    const minute = wrapped % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const parseMeridiemTime = (text) => {
    const match = normalizeWhitespace(text).match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (!match) return null;

    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridiem = match[3].toLowerCase();
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const urlDate = () => {
    const url = new URL(window.location.href);
    return (
      url.searchParams.get("date") ||
      new URLSearchParams(url.hash.replace(/^#\??/, "")).get("date") ||
      ""
    );
  };

  const pageDateIso = () => urlDate() || localDateIso();

  const dateIsoFromButtonText = (text, index) => {
    const normalized = normalizeWhitespace(text);
    if (/^today$/i.test(normalized)) return localDateIso();

    const match = normalized.match(/\b\d{1,2}\/\d{1,2}\b/);
    if (!match) return localDateIso(addDays(new Date(), index));

    const [monthText, dayText] = match[0].split("/");
    const today = new Date();
    let year = today.getFullYear();
    const month = Number(monthText);
    const day = Number(dayText);
    if (month < today.getMonth() + 1) year += 1;
    return localDateIso(new Date(year, month - 1, day));
  };

  const bookingUrlForDate = (dateIso, venue = {}) => {
    const base = venue.publicBookingUrl || venue.startUrl || window.location.href;
    return String(base || "").replace(/#.*$/, "");
  };

  const dateButtons = () =>
    Array.from(document.querySelectorAll("button")).filter((button) => {
      const text = normalizeWhitespace(button.innerText || button.textContent || "");
      return /^today$/i.test(text) || /^[A-Za-z]{3},\s*\d{1,2}\/\d{1,2}$/.test(text);
    });

  const candidateElements = () => {
    const elements = Array.from(
      document.querySelectorAll("button,a,[role='button'],li,div,section,article,tr,td,p,span")
    );
    return elements.filter((element) => {
      const text = normalizeWhitespace(element.innerText || element.textContent || "");
      if (!/\bopen\s+courts?\b/i.test(text) || !/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/i.test(text)) {
        return false;
      }

      return !Array.from(element.children).some((child) => {
        const childText = normalizeWhitespace(child.innerText || child.textContent || "");
        return /\bopen\s+courts?\b/i.test(childText) && /\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/i.test(childText);
      });
    });
  };

  const courtNamesFromText = (text) => {
    const names = new Set();
    for (const match of text.matchAll(/\bC\d+\b/gi)) names.add(match[0].toUpperCase());
    for (const match of text.matchAll(/\bCourt\s*\d+\b/gi)) names.add(normalizeWhitespace(match[0]));
    return Array.from(names);
  };

  const parseSlotRow = (element, venue = {}) => {
    const text = normalizeWhitespace(element.innerText || element.textContent || "");
    const startTime = parseMeridiemTime(text);
    if (!startTime) return [];

    const openCount = Number(text.match(/\b(\d+)\s+open\s+courts?\b/i)?.[1] || 1);
    if (!openCount) return [];

    const slotMinutes = Number(venue.slotMinutes || DEFAULT_SLOT_MINUTES);
    const endTime = minutesToTime(timeToMinutes(startTime) + slotMinutes);
    const courtNames = courtNamesFromText(text);
    const resourceNames = courtNames.length ? courtNames : ["Any open court"];

    return resourceNames.map((courtName) => ({
      title: courtName,
      start_time: startTime,
      end_time: endTime,
      status: "open",
      court_name: courtName,
      resource_count: openCount,
      source_text: text,
    }));
  };

  const rawOpenSlots = (venue = {}) => {
    const byKey = new Map();
    for (const element of candidateElements()) {
      for (const slot of parseSlotRow(element, venue)) {
        const key = `${slot.start_time}-${slot.end_time}-${slot.court_name}-${slot.source_text}`;
        byKey.set(key, slot);
      }
    }
    return Array.from(byKey.values()).sort((left, right) =>
      timeToMinutes(left.start_time) - timeToMinutes(right.start_time)
    );
  };

  const mergeOpenIntervals = (slots, minDurationMinutes = 0) => {
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

    return merged
      .filter((interval) => interval.end - interval.start >= minDurationMinutes)
      .map((interval) => ({
        start_time: minutesToTime(interval.start),
        end_time: minutesToTime(interval.end),
      }));
  };

  const sameCourtIntervals = (slots, minDurationMinutes = 0) => {
    const byCourt = new Map();
    for (const slot of slots) {
      const courtName = normalizeWhitespace(slot.court_name || "");
      if (!courtName || courtName === "Any open court") continue;
      byCourt.set(courtName, [...(byCourt.get(courtName) || []), slot]);
    }

    return Array.from(byCourt.entries())
      .map(([courtName, courtSlots]) => ({
        court_name: courtName,
        intervals: mergeOpenIntervals(courtSlots, minDurationMinutes),
      }))
      .filter((group) => group.intervals.length);
  };

  const remainingHours = (intervals) =>
    intervals.reduce(
      (sum, interval) => sum + (timeToMinutes(interval.end_time) - timeToMinutes(interval.start_time)) / 60,
      0
    );

  const loadedEmptyState = () =>
    /\b(no sessions|no availability|fully booked|nothing available|sold out|no courts available)\b/i.test(bodyText());

  const canRead = () => candidateElements().length > 0 || loadedEmptyState();
  const setupRequired = () => false;
  const selectDate = async (targetDate) => {
    const buttons = dateButtons();
    const targetIso = String(targetDate || "");
    const index = buttons.findIndex((button, buttonIndex) => dateIsoFromButtonText(button.innerText, buttonIndex) === targetIso);
    if (index < 0) return false;

    const before = normalizeWhitespace(document.body?.innerText || "");
    buttons[index].click();
    await waitUntil(() => normalizeWhitespace(document.body?.innerText || "") !== before, 6000);
    await wait(900);
    return true;
  };

  const minDurationMinutes = (venue = {}) => {
    if (Number(venue.minDurationMinutes || 0) > 0) return Number(venue.minDurationMinutes);
    if (Number(venue.minDurationHours || 0) > 0) return Number(venue.minDurationHours) * 60;
    return 0;
  };

  const readSelectedDay = (dateIso, venue = {}) => {
    const bookingUrl = bookingUrlForDate(dateIso, venue);
    const slots = rawOpenSlots(venue);
    const minimumMinutes = minDurationMinutes(venue);
    const openIntervals = mergeOpenIntervals(slots, minimumMinutes);
    const courtIntervals = sameCourtIntervals(slots, minimumMinutes);

    return {
      source_url: window.location.href,
      title: "Any pickleball court",
      date: dateLabel(dateIso),
      booking_date: dateIso,
      booking_url: bookingUrl,
      booking_action_url: bookingUrl,
      open_intervals: openIntervals,
      same_court_intervals: courtIntervals,
      continuity_status: courtIntervals.length ? "available" : "not_exposed",
      remaining_hours: remainingHours(openIntervals),
      raw_slots: slots,
    };
  };

  async function readAvailability(venue = {}) {
    if (!canRead()) {
      throw new Error("PodPlay availability rows are not visible yet. Wait for the booking page to finish loading.");
    }

    const buttons = dateButtons();
    const readDays = Math.max(1, Math.min(Number(venue.readDays || DEFAULT_READ_DAYS), buttons.length || 1));
    const days = [];

    if (buttons.length) {
      for (let index = 0; index < readDays; index += 1) {
        const currentButtons = dateButtons();
        const button = currentButtons[index];
        if (!button) break;

        const dateIso = dateIsoFromButtonText(button.innerText, index);
        if (index > 0) await selectDate(dateIso);
        days.push(readSelectedDay(dateIso, venue));
      }
    } else {
      days.push(readSelectedDay(pageDateIso(), venue));
    }

    return {
      exported_at: new Date().toISOString(),
      source_url: window.location.href,
      venue_id: venue.id || "houseofpickle-darlingharbour",
      venue_name: venue.name || "House of Pickle DH",
      provider_id: providerId,
      booking_url: bookingUrlForDate(days[0]?.booking_date || pageDateIso(), venue),
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
