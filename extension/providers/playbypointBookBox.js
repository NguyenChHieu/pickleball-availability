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

  const sectionForHeader = (root, headerText) => {
    const headers = Array.from(root.querySelectorAll("h2"));
    const header = headers.find(
      (candidate) => normalizeWhitespace(candidate.innerText).toLowerCase() === headerText.toLowerCase()
    );
    return (
      header?.closest(".mb20") ||
      header?.closest(".StepperItem") ||
      header?.closest("section") ||
      header?.parentElement ||
      null
    );
  };

  const selectedType = (root) => {
    const container = sectionForHeader(root, "Select Type");
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

  const sameCourtIntervals = (slots) => {
    const byCourt = new Map();
    for (const slot of slots) {
      const courtName = normalizeWhitespace(slot.court_name || "");
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

  const extractTimeButtons = (root) =>
    Array.from(root.querySelectorAll(".ButtonOption"))
      .map((button) => {
        const text = normalizeWhitespace(button.innerText);
        const timeRange = text.includes("-") && /\d/.test(text) ? normalizeTimeRange(text) : null;
        if (!timeRange) return null;
        return {
          button,
          text,
          timeRange,
          status: unavailableOption(button) ? "full" : "open",
        };
      })
      .filter(Boolean);

  const stripPrice = (value) =>
    normalizeWhitespace(value)
      .replace(/\bA?\$\s*\d+(?:\.\d{2})?\b/gi, "")
      .replace(/\b\d+(?:\.\d{2})?\s*aud\b/gi, "")
      .replace(/\s+-\s*$/g, "")
      .trim();

  const optionText = (button) => normalizeWhitespace(button.innerText || button.textContent || "");

  const optionLabel = (button) => {
    const explicit =
      button.getAttribute("data-resource-name") ||
      button.getAttribute("data-court-name") ||
      button.getAttribute("aria-label") ||
      button.getAttribute("title") ||
      "";
    const label = stripPrice(explicit || optionText(button));
    if (!label) return "";
    if (normalizeTimeRange(label)) return "";
    if (/^(next|continue|login|log in|sign in)$/i.test(label)) return "";
    return label;
  };

  const optionStateElement = (button) => button.closest?.(".ButtonOption, button, [role='button']") || button;

  const unavailableOption = (button) => {
    const stateElement = optionStateElement(button);
    const style = window.getComputedStyle(stateElement);
    const className = String(stateElement.className || "").toLowerCase();
    const text = optionText(stateElement).toLowerCase();
    return (
      stateElement.disabled ||
      stateElement.getAttribute("disabled") !== null ||
      stateElement.getAttribute("aria-disabled") === "true" ||
      stateElement.getAttribute("data-disabled") === "true" ||
      stateElement.getAttribute("data-status") === "disabled" ||
      stateElement.classList.contains("red") ||
      style.pointerEvents === "none" ||
      (Number(style.opacity) > 0 && Number(style.opacity) <= 0.55) ||
      /\b(disabled|inactive|unavailable|booked|full|soldout|sold-out)\b/.test(className) ||
      /\b(full|booked|sold out|unavailable)\b/.test(text)
    );
  };

  const selectedOption = (button) => {
    const stateElement = optionStateElement(button);
    return (
      stateElement.classList.contains("primary") ||
      stateElement.classList.contains("selected") ||
      stateElement.classList.contains("active") ||
      stateElement.getAttribute("aria-pressed") === "true" ||
      stateElement.getAttribute("aria-selected") === "true"
    );
  };

  const detailButtons = (root, title = "") => {
    const detailSection = sectionForHeader(root, "Select Detail");
    if (!detailSection) return [];
    const typeLabel = normalizeWhitespace(title).toLowerCase();
    return Array.from(detailSection.querySelectorAll(".ButtonOption, button, [role='button']"))
      .filter(isVisible)
      .map((button) => ({ button, label: optionLabel(button) }))
      .filter((item) => item.label && item.label.toLowerCase() !== typeLabel);
  };

  const selectedDetailLabel = (root, title = "") => {
    const selected = detailButtons(root, title).find(({ button }) => selectedOption(button));
    return selected?.label || "";
  };

  const nextButtonReady = (root) => {
    const nextButton = Array.from(root.querySelectorAll("button, [role='button']"))
      .filter(isVisible)
      .find((button) => /^(next|continue)\b/i.test(optionText(button)));
    if (!nextButton) return true;
    return !unavailableOption(nextButton);
  };

  const acceptedDetailOption = async (root, title, option) => {
    if (unavailableOption(option.button)) {
      return { accepted: false, selected: false, nextReady: false, reason: "option_unavailable" };
    }

    option.button.click();
    await waitUntil(() => selectedDetailLabel(bookBoxRoot() || root, title) === option.label, 300, 50);
    await wait(60);

    const currentRoot = bookBoxRoot() || root;
    const selected = selectedDetailLabel(currentRoot, title) === option.label;
    const nextReady = nextButtonReady(currentRoot);
    return {
      accepted: selected && nextReady,
      selected,
      nextReady,
      reason: selected && nextReady ? "accepted" : selected ? "next_blocked" : "not_selected",
    };
  };

  const courtSlotsForTime = async (root, title, timeButton, baseSlot) => {
    timeButton.click();
    await waitUntil(() => detailButtons(bookBoxRoot() || root, title).length > 0 || selectedOption(timeButton), 900, 50);
    await wait(120);

    const currentRoot = bookBoxRoot() || root;
    const optionLabels = Array.from(new Set(detailButtons(currentRoot, title).map((option) => option.label)));
    if (!optionLabels.length) {
      return { slots: [baseSlot], probes: [] };
    }

    const slots = [];
    const probes = [];
    for (const label of optionLabels) {
      timeButton.click();
      await wait(60);
      const option = detailButtons(bookBoxRoot() || currentRoot, title).find((item) => item.label === label);
      const result = option
        ? await acceptedDetailOption(bookBoxRoot() || currentRoot, title, option)
        : { accepted: false, selected: false, nextReady: false, reason: "option_missing" };
      probes.push({
        start_time: baseSlot.start_time,
        end_time: baseSlot.end_time,
        court_name: label,
        accepted: result.accepted,
        selected: result.selected,
        next_ready: result.nextReady,
        reason: result.reason,
      });
      if (result.accepted) {
        slots.push({ ...baseSlot, court_name: label });
      }
    }

    return { slots: slots.length ? slots : [baseSlot], probes };
  };

  const extractSlotsForLoadedDay = async (root, date, title) => {
    const slots = [];
    const probes = [];
    for (const { button, timeRange, status } of extractTimeButtons(root)) {
      const baseSlot = {
        title,
        date,
        ...timeRange,
        status,
      };

      if (status !== "open") {
        slots.push(baseSlot);
        continue;
      }

      const result = await courtSlotsForTime(bookBoxRoot() || root, title, button, baseSlot);
      slots.push(...result.slots);
      probes.push(...result.probes);
    }
    return { slots, probes };
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

  const setupRequired = () => loginGateVisible();

  async function selectDate(targetDate) {
    if (loginGateVisible()) return false;
    await clickDayAndWait(targetDate);
    return true;
  }

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
      const { slots, probes } = await extractSlotsForLoadedDay(loadedRoot, currentDate, title);
      const openIntervals = mergeOpenIntervals(slots);
      const courtIntervals = sameCourtIntervals(slots);
      const hasCourtLabels = slots.some((slot) => normalizeWhitespace(slot.court_name || ""));

      results.push({
        source_url: window.location.href,
        title,
        date: currentDate,
        booking_date: currentDate,
        open_intervals: openIntervals,
        same_court_intervals: courtIntervals,
        continuity_status: hasCourtLabels ? "available" : "not_exposed",
        remaining_hours: remainingHours(openIntervals),
        raw_slots: slots,
        probe_debug: probes,
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
      booking_url: venue.startUrl || window.location.href,
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
