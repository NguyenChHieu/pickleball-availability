((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ProPickleProbeTarget = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function timeToMinutes(value) {
    const match = String(value || "")
      .trim()
      .toLowerCase()
      .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (!match) return null;

    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const period = match[3];
    if (period === "am" && hour === 12) hour = 0;
    if (period === "pm" && hour !== 12) hour += 12;
    return hour * 60 + minute;
  }

  function intervalCovers(interval, start, end) {
    const intervalStart = timeToMinutes(interval?.start_time);
    const intervalEnd = timeToMinutes(interval?.end_time);
    const targetStart = timeToMinutes(start);
    const targetEnd = timeToMinutes(end);
    if ([intervalStart, intervalEnd, targetStart, targetEnd].some((value) => value === null)) return false;
    return intervalStart <= targetStart && intervalEnd >= targetEnd;
  }

  function sameCourtMap(day) {
    const byCourt = new Map();
    const groups = Array.isArray(day?.same_court_intervals) ? day.same_court_intervals : [];
    for (const group of groups) {
      const court = String(group.court_name || group.courtName || group.resource_name || group.provider_name || "").trim();
      if (!court) continue;
      byCourt.set(court.toLowerCase(), Array.isArray(group.intervals) ? group.intervals : []);
    }
    return byCourt;
  }

  function targetSplitFailures(day) {
    const byCourt = sameCourtMap(day);
    const expected = [
      ["court 1", "10pm-11pm"],
      ["court 2", "10pm-11pm"],
      ["court 3", "10pm-11pm"],
      ["court 4", "9pm-10pm"],
      ["court 4", "10pm-11pm"],
      ["court 5", "10pm-11pm"],
      ["court 6", "10pm-11pm"],
    ];
    const failures = [];

    for (const [court, interval] of expected) {
      const [start, end] = interval.split("-");
      const intervals = byCourt.get(court) || [];
      if (!intervals.some((current) => intervalCovers(current, start, end))) failures.push(`${court} missing ${interval}`);
    }

    if (day?.continuity_status !== "available") {
      failures.push(`continuity_status should be available, got ${day?.continuity_status || "missing"}`);
    }

    return failures;
  }

  return Object.freeze({
    intervalCovers,
    targetSplitFailures,
    timeToMinutes,
  });
});
