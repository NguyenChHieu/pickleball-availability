(() => {
  const providerId = "mindbody-appointments";
  globalThis.AvailabilityProviders = globalThis.AvailabilityProviders || {};
  if (globalThis.AvailabilityProviders[providerId]) return;

  const DEFAULT_READ_DAYS = 9;
  const DEFAULT_SLOT_MINUTES = 30;
  const PAGE_TIMEOUT_MS = 9000;
  const DAY_TIMEOUT_MS = 7000;
  const SETTLE_MS = 650;
  const STAFF_ID = "any_staff";

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
  const monthLookup = Object.fromEntries(monthNames.map((name, index) => [name.toLowerCase(), index]));
  const weekdayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayLong = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const normalizeWhitespace = (value) => (value || "").replace(/\s+/g, " ").trim();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    return `${weekdayLong[date.getDay()]}, ${monthNames[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")}`;
  };

  const pageText = () => normalizeWhitespace(document.body?.innerText || "");
  const serviceButtons = () => Array.from(document.querySelectorAll("button[data-service-id]"));
  const hasServicesPage = () => serviceButtons().length > 0 && pageText().includes("Court Hire");
  const hasStaffPage = () => pageText().includes("Select your provider");
  const hasSchedulePage = () => /Availability for [A-Za-z]+ \d{1,2}, \d{4}/.test(pageText());
  const canRead = () => hasServicesPage() || hasSchedulePage();
  const setupRequired = () => false;

  const clickByText = (selector, textPattern) => {
    const element = Array.from(document.querySelectorAll(selector)).find((candidate) =>
      textPattern.test(normalizeWhitespace(candidate.innerText || candidate.textContent || ""))
    );
    if (!element) return false;
    element.click();
    return true;
  };

  const serviceButtonFor = (service) =>
    document.querySelector(`button[data-service-id="${CSS.escape(service.serviceButtonId)}"]`);

  const firstAvailableOption = Object.freeze({
    providerId: STAFF_ID,
    providerName: "First Available",
    availabilityScope: "first_available",
  });

  const staffOptionElements = () => Array.from(document.querySelectorAll('[data-testid^="bw:selector-"]'));

  const staffOptionId = (element) => {
    const testId = element.getAttribute("data-testid") || "";
    return testId.startsWith("bw:selector-") ? testId.slice("bw:selector-".length) : "";
  };

  const staffOptionClickTarget = (element) => element.closest("button, [role='button'], a") || element;

  const staffOptionLabel = (element, providerId) => {
    const text = normalizeWhitespace(element.innerText || element.textContent || "");
    if (text) return text;
    return providerId === STAFF_ID ? "First Available" : providerId;
  };

  const discoverProviderOptions = () =>
    staffOptionElements()
      .map((element) => {
        const providerId = staffOptionId(element);
        const providerName = staffOptionLabel(element, providerId);
        return providerId ? { providerId, providerName, availabilityScope: "provider" } : null;
      })
      .filter(
        (option) =>
          option &&
          option.providerId !== STAFF_ID &&
          !/first\s+available/i.test(option.providerName)
      );

  const clickStaffOption = (providerId) => {
    const element = staffOptionElements().find((candidate) => staffOptionId(candidate) === providerId);
    if (!element) return false;
    staffOptionClickTarget(element).click();
    return true;
  };

  const goToServicesPage = async () => {
    if (hasServicesPage()) return true;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (!clickByText("button", /^Back$/i)) break;
      const loaded = await waitUntil(hasServicesPage, PAGE_TIMEOUT_MS);
      if (loaded) return true;
      await wait(SETTLE_MS);
    }

    return hasServicesPage();
  };

  const openServiceStaffPage = async (service) => {
    const servicesReady = await goToServicesPage();
    if (!servicesReady) throw new Error("Could not return to the Mindbody service list.");

    const serviceButton = serviceButtonFor(service);
    if (!serviceButton) throw new Error(`Could not find Mindbody service: ${service.name}.`);
    serviceButton.click();

    const staffReady = await waitUntil(hasStaffPage, PAGE_TIMEOUT_MS);
    if (!staffReady) throw new Error(`Timed out waiting for ${service.name} provider selection.`);
    await wait(SETTLE_MS);
  };

  const openProviderSchedule = async (service, provider) => {
    const selected = clickStaffOption(provider.providerId);
    if (!selected) throw new Error(`Could not find ${provider.providerName} for ${service.name}.`);
    await wait(SETTLE_MS);

    const continued = clickByText("a, button", /^Continue$/i);
    if (!continued) throw new Error(`Could not continue to ${service.name} schedule for ${provider.providerName}.`);

    const scheduleReady = await waitUntil(hasSchedulePage, PAGE_TIMEOUT_MS);
    if (!scheduleReady) throw new Error(`Timed out waiting for ${service.name} schedule for ${provider.providerName}.`);
    await wait(SETTLE_MS);
  };

  const selectedScheduleDate = () => {
    const match = pageText().match(/Availability for ([A-Za-z]+) (\d{1,2}), (\d{4})/);
    if (!match) return null;
    const month = monthLookup[match[1].toLowerCase()];
    if (month === undefined) return null;
    return new Date(Number(match[3]), month, Number(match[2]));
  };

  const selectedScheduleDateIso = () => {
    const date = selectedScheduleDate();
    return date ? localDateIso(date) : "";
  };

  const dateButtonText = (element) => normalizeWhitespace(element.innerText || element.textContent || "");

  const dateFromButtonText = (text, referenceDate) => {
    const match = text.match(/^(Today|Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\d{1,2})$/);
    if (!match) return null;

    const label = match[1];
    const dayNumber = Number(match[2]);
    const reference = referenceDate || new Date();
    const candidates = [];

    for (let offset = -7; offset <= 24; offset += 1) {
      const date = new Date(reference);
      date.setDate(reference.getDate() + offset);
      if (date.getDate() !== dayNumber) continue;
      if (label !== "Today" && weekdayShort[date.getDay()] !== label) continue;
      candidates.push(date);
    }

    if (!candidates.length) return null;
    candidates.sort((left, right) => Math.abs(left - reference) - Math.abs(right - reference));
    return candidates[0];
  };

  const visibleDateButtons = () => {
    const referenceDate = selectedScheduleDate() || new Date();
    return Array.from(document.querySelectorAll('[role="button"]'))
      .map((element) => {
        const text = dateButtonText(element);
        const date = dateFromButtonText(text, referenceDate);
        return date ? { element, text, dateIso: localDateIso(date) } : null;
      })
      .filter(Boolean)
      .sort((left, right) => String(left.dateIso).localeCompare(String(right.dateIso)));
  };

  const dateStripFingerprint = () => visibleDateButtons().map((button) => button.text).join("|");

  const clickWeekArrow = async (direction) => {
    const label = direction > 0 ? "Next" : "Previous";
    const button = document.querySelector(`button[aria-label="${label}"]`);
    if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return false;

    const before = dateStripFingerprint();
    button.click();
    return waitUntil(() => dateStripFingerprint() !== before, DAY_TIMEOUT_MS);
  };

  const loadDate = async (dateIso) => {
    if (selectedScheduleDateIso() === dateIso) return true;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const buttons = visibleDateButtons();
      const targetButton = buttons.find((button) => button.dateIso === dateIso);
      if (targetButton) {
        targetButton.element.click();
        const selected = await waitUntil(() => selectedScheduleDateIso() === dateIso, DAY_TIMEOUT_MS);
        if (selected) {
          await wait(SETTLE_MS);
          return true;
        }
      }

      const first = buttons[0]?.dateIso || "";
      const last = buttons[buttons.length - 1]?.dateIso || "";
      const moved =
        dateIso > last ? await clickWeekArrow(1) : dateIso < first ? await clickWeekArrow(-1) : false;
      if (!moved) return false;
      await wait(SETTLE_MS);
    }

    return selectedScheduleDateIso() === dateIso;
  };

  const timeToMinutes = (value) => {
    const match = normalizeWhitespace(value)
      .toLowerCase()
      .match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
    if (!match) throw new Error(`Unsupported Mindbody time value: ${value}`);

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3];
    if (hour === 12) hour = 0;
    if (period === "pm") hour += 12;
    return hour * 60 + minute;
  };

  const minutesToTime = (minutes) => {
    const hour24 = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const period = hour24 < 12 || hour24 === 24 ? "am" : "pm";
    const hour = hour24 % 12 || 12;
    return `${hour}:${String(minute).padStart(2, "0")}${period}`;
  };

  const extractOpenSlots = (dateIso, service, provider = firstAvailableOption) =>
    Array.from(document.querySelectorAll('[role="button"]'))
      .map((element) => normalizeWhitespace(element.innerText || element.textContent || ""))
      .filter((text) => /^\d{1,2}:\d{2}\s*[AP]M$/i.test(text))
      .map((startText) => {
        const start = timeToMinutes(startText);
        const isFirstAvailable = provider.providerId === STAFF_ID;
        return {
          title: service.name,
          service_name: service.name,
          level_name: service.name,
          date: dateLabel(dateIso),
          start_time: minutesToTime(start),
          end_time: minutesToTime(start + Number(service.slotMinutes || DEFAULT_SLOT_MINUTES)),
          status: "open",
          price: service.price || "",
          provider_id: isFirstAvailable ? "" : provider.providerId,
          provider_name: isFirstAvailable ? "" : provider.providerName,
          court_name: isFirstAvailable ? "" : provider.providerName,
          availability_scope: provider.availabilityScope || (isFirstAvailable ? "first_available" : "provider"),
        };
      });

  const mergeOpenIntervals = (slots) => {
    const intervals = slots
      .filter((slot) => slot.status === "open")
      .map((slot) => ({ start: timeToMinutes(slot.start_time), end: timeToMinutes(slot.end_time) }))
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

  const remainingHours = (intervals) =>
    intervals.reduce(
      (sum, interval) => sum + (timeToMinutes(interval.end_time) - timeToMinutes(interval.start_time)) / 60,
      0
    );

  const levelIntervals = (slots) => {
    const byLevel = new Map();
    for (const slot of slots) {
      const levelName = normalizeWhitespace(slot.title || slot.service_name || "Court hire");
      const price = normalizeWhitespace(slot.price || "");
      const key = `${levelName}|${price}`;
      byLevel.set(key, [...(byLevel.get(key) || []), slot]);
    }

    return Array.from(byLevel.values())
      .map((levelSlots) => ({
        level_name: normalizeWhitespace(levelSlots[0]?.title || levelSlots[0]?.service_name || "Court hire"),
        price: normalizeWhitespace(levelSlots[0]?.price || ""),
        intervals: mergeOpenIntervals(levelSlots),
      }))
      .filter((group) => group.level_name && group.intervals.length);
  };

  const providerIntervals = (slots) => {
    const byProviderAndLevel = new Map();
    for (const slot of slots) {
      const providerName = normalizeWhitespace(slot.provider_name || slot.court_name || "");
      if (!providerName) continue;

      const levelName = normalizeWhitespace(slot.level_name || slot.service_name || slot.title || "Court hire");
      const price = normalizeWhitespace(slot.price || "");
      const providerId = normalizeWhitespace(slot.provider_id || providerName);
      const key = `${levelName}|${price}|${providerId}`;
      byProviderAndLevel.set(key, [...(byProviderAndLevel.get(key) || []), slot]);
    }

    return Array.from(byProviderAndLevel.values())
      .map((providerSlots) => ({
        court_name: normalizeWhitespace(providerSlots[0]?.court_name || providerSlots[0]?.provider_name || ""),
        provider_name: normalizeWhitespace(providerSlots[0]?.provider_name || providerSlots[0]?.court_name || ""),
        provider_id: normalizeWhitespace(providerSlots[0]?.provider_id || ""),
        level_name: normalizeWhitespace(providerSlots[0]?.level_name || providerSlots[0]?.service_name || providerSlots[0]?.title || ""),
        price: normalizeWhitespace(providerSlots[0]?.price || ""),
        intervals: mergeOpenIntervals(providerSlots),
      }))
      .filter((group) => group.court_name && group.level_name && group.intervals.length);
  };

  const bookingUrlForVenue = (venue = {}) => venue.publicBookingUrl || venue.startUrl || window.location.href;

  async function selectDate(targetDate) {
    const isoMatch = String(targetDate || "").match(/\d{4}-\d{2}-\d{2}/);
    return isoMatch ? loadDate(isoMatch[0]) : false;
  }

  async function readAvailability(venue = {}) {
    const services = Array.isArray(venue.services) ? venue.services : [];
    if (!services.length) throw new Error("Mindbody venue is missing service configuration.");

    const readDays = Number(venue.readDays || DEFAULT_READ_DAYS);
    const shouldReadProviders = venue.readProviders !== false;
    const maxProviders = Number(venue.maxProviders || 0);
    const slotsByDate = new Map();
    const providerSlotsByDate = new Map();
    const providerReadErrors = [];
    let targetDates = [];
    let baseDateIso = "";

    for (const service of services) {
      await openServiceStaffPage(service);
      const providerOptions = shouldReadProviders
        ? discoverProviderOptions().slice(0, maxProviders > 0 ? maxProviders : undefined)
        : [];

      await openProviderSchedule(service, firstAvailableOption);

      if (!baseDateIso) {
        baseDateIso = selectedScheduleDateIso() || localDateIso();
        targetDates = Array.from({ length: readDays }, (_unused, offset) => addDays(baseDateIso, offset));
      }

      for (const dateIso of targetDates) {
        const loaded = await loadDate(dateIso);
        if (!loaded) throw new Error(`Opened ${dateIso}; wait for the Mindbody schedule to load, then read again.`);

        const slots = extractOpenSlots(dateIso, service, firstAvailableOption);
        slotsByDate.set(dateIso, [...(slotsByDate.get(dateIso) || []), ...slots]);
      }

      for (const provider of providerOptions) {
        try {
          await openServiceStaffPage(service);
          await openProviderSchedule(service, provider);

          for (const dateIso of targetDates) {
            const loaded = await loadDate(dateIso);
            if (!loaded) throw new Error(`Opened ${dateIso}; wait for the Mindbody schedule to load, then read again.`);

            const slots = extractOpenSlots(dateIso, service, provider);
            providerSlotsByDate.set(dateIso, [...(providerSlotsByDate.get(dateIso) || []), ...slots]);
          }
        } catch (error) {
          providerReadErrors.push({
            service_name: service.name,
            provider_name: provider.providerName,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const bookingUrl = bookingUrlForVenue(venue);
    const days = targetDates.map((dateIso) => {
      const rawSlots = slotsByDate.get(dateIso) || [];
      const rawProviderSlots = providerSlotsByDate.get(dateIso) || [];
      const openIntervals = mergeOpenIntervals(rawSlots);
      const levels = levelIntervals(rawSlots);
      const providerRuns = providerIntervals(rawProviderSlots);
      return {
        source_url: window.location.href,
        title: "Any pickleball court",
        date: dateLabel(dateIso),
        booking_date: dateIso,
        booking_url: bookingUrl,
        booking_action_url: bookingUrl,
        open_intervals: openIntervals,
        same_court_intervals: providerRuns,
        level_intervals: levels,
        remaining_hours: remainingHours(openIntervals),
        raw_slots: rawSlots,
        raw_provider_slots: rawProviderSlots,
      };
    });

    return {
      exported_at: new Date().toISOString(),
      source_url: window.location.href,
      venue_id: venue.id || "northryde",
      venue_name: venue.name || "North Ryde Pickleball",
      provider_id: providerId,
      booking_url: bookingUrl,
      provider_read_errors: providerReadErrors,
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
