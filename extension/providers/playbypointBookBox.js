(() => {
  const providerId = "playbypoint-bookbox";
  globalThis.AvailabilityProviders = globalThis.AvailabilityProviders || {};
  if (globalThis.AvailabilityProviders[providerId]) return;

  const config = {
    daySettleMs: 1400,
    dayLoadTimeoutMs: 6000,
    clickLimit: 14,
  };

  const dayNames = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  };

  const dayLookup = Object.fromEntries(
    Object.entries(dayNames).flatMap(([abbr, full]) => [
      [abbr, abbr],
      [full.toLowerCase(), abbr],
    ])
  );

  const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLookup = Object.fromEntries(
    [
      ["Jan", "January"],
      ["Feb", "February"],
      ["Mar", "March"],
      ["Apr", "April"],
      ["May", "May"],
      ["Jun", "June"],
      ["Jul", "July"],
      ["Aug", "August"],
      ["Sep", "September"],
      ["Oct", "October"],
      ["Nov", "November"],
      ["Dec", "December"],
    ].flatMap(([abbr, full]) => [
      [abbr.toLowerCase(), abbr],
      [full.toLowerCase(), abbr],
    ])
  );

  const normalizeWhitespace = (value) => (value || "").replace(/\s+/g, " ").trim();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalizeMonth = (value) => monthLookup[normalizeWhitespace(value).toLowerCase()] || "";
  const normalizeDay = (value) => dayLookup[normalizeWhitespace(value).toLowerCase()] || "";
  const bookBoxRoot = () => document.querySelector('[data-react-class="BookBox"]');
  const normalizedText = (element) => normalizeWhitespace(element?.innerText || "").toLowerCase();

  const isVisible = (element) => {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };

  const hasLoginContinueText = (element) => {
    const text = normalizedText(element);
    return text.includes("login to continue") || text.includes("log in to continue");
  };

  const loginDialogVisible = () =>
    Array.from(
      document.querySelectorAll(
        '[role="dialog"], .modal, .modal-dialog, .modal-content, .ReactModal__Content, [class*="Modal"], [class*="modal"]'
      )
    ).some((element) => {
      if (!isVisible(element)) return false;
      const text = normalizedText(element);
      const hasLoginText = text.includes("login") || text.includes("log in") || text.includes("sign in");
      const hasFormText = text.includes("email") || text.includes("password") || text.includes("continue");
      return hasLoginText && hasFormText;
    });

  const loginGateVisible = (root = bookBoxRoot()) => {
    if (root && hasLoginContinueText(root)) return true;
    if (document.body && hasLoginContinueText(document.body)) return true;
    if (loginDialogVisible()) return true;

    return Array.from(document.querySelectorAll("a, button")).some((element) => {
      if (!isVisible(element)) return false;
      const text = normalizedText(element);
      return text === "login to continue" || text === "log in to continue";
    });
  };

  const dateKey = (label) => {
    const parts = normalizeWhitespace(label).replaceAll(",", "").split(" ");
    const weekday = normalizeDay(parts[0]);
    const month = parts.map(normalizeMonth).find(Boolean) || "";
    const dayNumber = parts.find((part) => /^\d{1,2}$/.test(part));
    return weekday && month && dayNumber ? `${weekday}:${month}:${Number(dayNumber)}` : normalizeWhitespace(label);
  };

  const sameDate = (left, right) => dateKey(left) === dateKey(right);

  const waitUntil = async (predicate, timeoutMs, intervalMs = 100) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return true;
      await wait(intervalMs);
    }
    return predicate();
  };

  const previousMonth = (month) => {
    const index = monthOrder.indexOf(month);
    return index === -1 ? month : monthOrder[(index + monthOrder.length - 1) % monthOrder.length];
  };

  const selectedDateText = (root) => {
    if (!root) return "";
    const summary = root.querySelector(".StepperItem .summary");
    const text = normalizeWhitespace(summary?.innerText || "");
    if (text.includes(", No time selected")) return text.split(", No time selected")[0].trim();
    if (text.includes(", ")) return text.split(", ").slice(0, -1).join(", ").trim();
    return text;
  };

  const monthFromDateLabel = (label) => {
    for (const part of normalizeWhitespace(label).replaceAll(",", "").split(" ")) {
      const month = normalizeMonth(part);
      if (month) return month;
    }
    return "";
  };

  const monthForGroup = (group, selectedMonth, explicitMonths, groupIndex) => {
    const explicit = group.parentElement?.querySelector(":scope > .month");
    if (explicit) return normalizeMonth(explicit.innerText);
    if (groupIndex === 0 && explicitMonths.length) return previousMonth(explicitMonths[0]);
    return selectedMonth || explicitMonths[0] || "";
  };

  const visibleDayButtons = (root) => {
    if (!root) return [];
    const daysRange = root.querySelector(".DaysRangeOptions");
    if (!daysRange) return [];

    const selectedMonth = monthFromDateLabel(selectedDateText(root));
    const explicitMonths = Array.from(daysRange.querySelectorAll(".month"))
      .map((element) => normalizeMonth(element.innerText))
      .filter(Boolean);

    const groups = Array.from(daysRange.querySelectorAll(".range-container"));
    const days = [];
    for (const [groupIndex, group] of groups.entries()) {
      const month = monthForGroup(group, selectedMonth, explicitMonths, groupIndex);
      for (const button of Array.from(group.querySelectorAll(".day-container button"))) {
        const shortDay = normalizeWhitespace(button.querySelector(".day_name")?.innerText || "");
        const number = normalizeWhitespace(button.querySelector(".day_number")?.innerText || "");
        if (!shortDay || !number) continue;
        const day = normalizeDay(shortDay) || shortDay.toLowerCase();
        days.push({
          button,
          date: `${dayNames[day] || shortDay}, ${month} ${number.padStart(2, "0")}`,
        });
      }
    }
    return days.slice(0, config.clickLimit);
  };

  const dayButtonForDate = (targetDate) => {
    const root = bookBoxRoot();
    const day = visibleDayButtons(root).find((candidate) => sameDate(candidate.date, targetDate));
    return { root, button: day?.button };
  };

  const clickDayAndWait = async (targetDate) => {
    const { root, button } = dayButtonForDate(targetDate);
    if (!root || !button) throw new Error(`Could not find the day button for ${targetDate}.`);

    // Read-only interaction: only day tabs inside the calendar strip.
    button.click();
    await wait(250);
    if (loginGateVisible()) throw new Error("Log in before reading availability times.");

    const loaded = await waitUntil(
      () => sameDate(selectedDateText(bookBoxRoot()), targetDate),
      config.dayLoadTimeoutMs
    );
    if (!loaded) {
      const selectedDate = selectedDateText(bookBoxRoot()) || "unknown date";
      throw new Error(`Timed out waiting for ${targetDate} to load; page shows ${selectedDate}.`);
    }

    await wait(config.daySettleMs);
    const loadedRoot = bookBoxRoot();
    if (!loadedRoot) throw new Error(`The booking widget disappeared after loading ${targetDate}.`);
    if (loginGateVisible(loadedRoot)) throw new Error("Log in before reading availability times.");
    return loadedRoot;
  };

  const selectedType = (root) => {
    const headers = Array.from(root.querySelectorAll("h2"));
    const selectTypeHeader = headers.find(
      (header) => normalizeWhitespace(header.innerText).toLowerCase() === "select type"
    );
    const container = selectTypeHeader?.closest(".mb20");
    return normalizeWhitespace(container?.querySelector(".ButtonOption.primary")?.innerText || "Court booking");
  };

  const normalizeTimeRange = (text) => {
    const clean = normalizeWhitespace(text).replace(/\+/g, "").trim().toLowerCase().replace(/\s+/g, "");
    const [rawStart, rawEnd] = clean.split("-");
    if (!rawStart || !rawEnd) return null;

    let start = rawStart;
    const end = rawEnd;
    const endPeriod = end.match(/(am|pm)$/)?.[1];
    const startPeriod = start.match(/(am|pm)$/)?.[1];
    if (!startPeriod && endPeriod) {
      const startHour = Number(start.match(/^\d{1,2}/)?.[0]);
      const endHour = Number(end.match(/^\d{1,2}/)?.[0]);
      if (endPeriod === "pm" && endHour === 12 && startHour < 12) start = `${start}am`;
      else start = `${start}${endPeriod}`;
    }

    return { start_time: start, end_time: end };
  };

  const timeToMinutes = (value) => {
    const match = normalizeWhitespace(value)
      .toLowerCase()
      .replace(/\s+/g, "")
      .match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
    if (!match) throw new Error(`Unsupported time value: ${value}`);

    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
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
    return `${hour}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${period}`;
  };

  const mergeOpenIntervals = (slots) => {
    const intervals = slots
      .filter((slot) => slot.status === "open")
      .map((slot) => ({ start: timeToMinutes(slot.start_time), end: timeToMinutes(slot.end_time) }))
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

  const extractSlotsForLoadedDay = (root, date, title) => {
    const slots = [];
    for (const button of Array.from(root.querySelectorAll(".ButtonOption"))) {
      const text = normalizeWhitespace(button.innerText);
      if (!text.includes("-") || !/\d/.test(text)) continue;
      const timeRange = normalizeTimeRange(text);
      if (!timeRange) continue;
      slots.push({
        title,
        date,
        ...timeRange,
        status: button.classList.contains("red") || button.disabled ? "full" : "open",
      });
    }
    return slots;
  };

  const remainingHours = (intervals) =>
    intervals.reduce(
      (sum, interval) => sum + (timeToMinutes(interval.end_time) - timeToMinutes(interval.start_time)) / 60,
      0
    );

  const canRead = () => {
    const root = bookBoxRoot();
    return Boolean(root && !loginGateVisible(root) && visibleDayButtons(root).length);
  };

  async function readAvailability(venue = {}) {
    const root = bookBoxRoot();
    if (!root) throw new Error("Could not find the Playbypoint booking widget on this page.");
    if (loginGateVisible(root)) throw new Error("Log in before reading availability times.");

    const dayTargets = visibleDayButtons(root).map((day) => day.date);
    if (!dayTargets.length) throw new Error("Could not find visible booking day buttons.");

    const results = [];
    for (const targetDate of dayTargets) {
      const loadedRoot = await clickDayAndWait(targetDate);
      const currentDate = selectedDateText(loadedRoot) || targetDate;
      const title = selectedType(loadedRoot);
      const slots = extractSlotsForLoadedDay(loadedRoot, currentDate, title);
      const openIntervals = mergeOpenIntervals(slots);

      results.push({
        source_url: window.location.href,
        title,
        date: currentDate,
        open_intervals: openIntervals,
        remaining_hours: remainingHours(openIntervals),
        raw_slots: slots,
      });
    }

    const slotCount = results.reduce((sum, day) => sum + day.raw_slots.length, 0);
    if (!slotCount && loginGateVisible()) throw new Error("Log in before reading availability times.");

    return {
      exported_at: new Date().toISOString(),
      source_url: window.location.href,
      venue_id: venue.id || "",
      venue_name: venue.name || "",
      provider_id: providerId,
      days: results,
    };
  }

  globalThis.AvailabilityProviders[providerId] = Object.freeze({
    providerId,
    canRead,
    readAvailability,
  });
})();
