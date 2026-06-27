/*
 * Read-only ProPickle/Playbypoint availability exporter.
 *
 * Usage:
 * 1. Open the ProPickle booking page in normal Chrome.
 * 2. Log in and accept any waiver manually if you genuinely agree.
 * 3. Open DevTools Console.
 * 4. Paste this whole file and press Enter.
 *
 * It only clicks visible day buttons in the booking calendar strip and reads
 * visible time buttons. It does not click Next, Book, payment, checkout, or
 * login controls.
 */
(async () => {
  const config = {
    // Wait after each day-tab click so Playbypoint can re-render the time buttons.
    daySettleMs: 1400,
    // Safety cap: only inspect a small visible date window, not an unbounded calendar.
    clickLimit: 14,
  };

  const dayNames = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday",
  };

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
  const previousMonth = (month) => {
    const index = monthOrder.indexOf(month);
    return index === -1 ? month : monthOrder[(index + monthOrder.length - 1) % monthOrder.length];
  };

  const selectedDateText = (root) => {
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
        days.push({
          button,
          date: `${dayNames[shortDay.slice(0, 3)] || shortDay}, ${month} ${number.padStart(2, "0")}`,
        });
      }
    }
    return days.slice(0, config.clickLimit);
  };

  const selectedType = (root) => {
    const headers = Array.from(root.querySelectorAll("h2"));
    const selectTypeHeader = headers.find((header) => normalizeWhitespace(header.innerText).toLowerCase() === "select type");
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
    const match = normalizeWhitespace(value).toLowerCase().replace(/\s+/g, "").match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
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

  const root = document.querySelector('[data-react-class="BookBox"]');
  if (!root) throw new Error("Could not find Playbypoint BookBox on this page.");

  const days = visibleDayButtons(root);
  if (!days.length) throw new Error("Could not find visible booking day buttons.");

  const results = [];
  for (const day of days) {
    console.log(`Reading ${day.date}`);
    // The only automated interaction: click a day tab inside the calendar strip.
    // The script never clicks Next, Book, checkout, payment, login, or modal buttons.
    day.button.click();
    await wait(config.daySettleMs);

    const currentDate = selectedDateText(root) || day.date;
    const title = selectedType(root);
    const slots = extractSlotsForLoadedDay(root, currentDate, title);
    const openIntervals = mergeOpenIntervals(slots);

    results.push({
      source_url: window.location.href,
      title,
      date: currentDate,
      open_intervals: openIntervals,
      remaining_hours: openIntervals.reduce(
        (sum, interval) => sum + (timeToMinutes(interval.end_time) - timeToMinutes(interval.start_time)) / 60,
        0
      ),
      raw_slots: slots,
    });
  }

  const payload = {
    exported_at: new Date().toISOString(),
    source_url: window.location.href,
    days: results,
  };
  const json = JSON.stringify(payload, null, 2);
  console.log(json);

  try {
    await navigator.clipboard.writeText(json);
    console.log("Copied ProPickle availability JSON to clipboard.");
  } catch (error) {
    console.warn("Could not copy to clipboard. Copy the JSON printed above instead.", error);
  }

  const blob = new Blob([json], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "browser_availability.json";
  link.click();
  URL.revokeObjectURL(link.href);
})();
