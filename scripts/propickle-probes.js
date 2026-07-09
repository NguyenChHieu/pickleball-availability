#!/usr/bin/env node

const fs = require("node:fs");

function usage() {
  console.error("Usage: node scripts/propickle-probes.js <payload-or-cache-record.json> [date text] [--assert-target]");
  console.error('Example: node scripts/propickle-probes.js data/propickle.json "Thursday, July 16" --assert-target');
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Error(`Could not read ${filePath}: ${error.message}`);
  }
}

function payloadFrom(value) {
  return value && typeof value === "object" && value.payload ? value.payload : value;
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function byTime(probes) {
  const groups = new Map();
  for (const probe of probes) {
    const key = `${probe.start_time || "?"}-${probe.end_time || "?"}`;
    groups.set(key, [...(groups.get(key) || []), probe]);
  }
  return Array.from(groups.entries());
}

function courtList(probes, accepted) {
  return probes
    .filter((probe) => Boolean(probe.accepted) === accepted)
    .map((probe) => {
      const court = probe.court_name || "?";
      return accepted ? court : `${court} (${probe.reason || "rejected"})`;
    });
}

function formatIntervals(intervals) {
  return Array.isArray(intervals) && intervals.length
    ? intervals.map((interval) => `${interval.start_time || "?"}-${interval.end_time || "?"}`).join(", ")
    : "none";
}

function printDaySummary(day) {
  console.log(`  continuity_status: ${day.continuity_status || "unknown"}`);
  console.log(`  any-court: ${formatIntervals(day.open_intervals)}`);

  const sameCourt = Array.isArray(day.same_court_intervals) ? day.same_court_intervals : [];
  if (!sameCourt.length) {
    console.log("  same-court: none");
    return;
  }

  console.log("  same-court:");
  for (const group of sameCourt) {
    const court = group.court_name || group.courtName || group.resource_name || group.provider_name || "?";
    console.log(`    ${court}: ${formatIntervals(group.intervals)}`);
  }
}

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
  const map = new Map();
  const sameCourt = Array.isArray(day.same_court_intervals) ? day.same_court_intervals : [];
  for (const group of sameCourt) {
    const court = String(group.court_name || group.courtName || group.resource_name || group.provider_name || "").trim();
    if (!court) continue;
    map.set(court.toLowerCase(), Array.isArray(group.intervals) ? group.intervals : []);
  }
  return map;
}

function assertTargetSplit(day) {
  const byCourt = sameCourtMap(day);
  const expected = new Map([
    ["court 1", "10pm-11pm"],
    ["court 2", "10pm-11pm"],
    ["court 3", "10pm-11pm"],
    ["court 4", "9pm-10pm"],
    ["court 5", "10pm-11pm"],
    ["court 6", "10pm-11pm"],
  ]);
  const failures = [];

  for (const [court, interval] of expected.entries()) {
    const intervals = byCourt.get(court) || [];
    const [start, end] = interval.split("-");
    if (!intervals.some((current) => intervalCovers(current, start, end))) failures.push(`${court} missing ${interval}`);
  }

  const court4 = byCourt.get("court 4") || [];
  if (court4.some((interval) => intervalCovers(interval, "10pm", "11pm"))) {
    failures.push("court 4 should not cover 10pm-11pm");
  }

  if (day.continuity_status !== "available") {
    failures.push(`continuity_status should be available, got ${day.continuity_status || "missing"}`);
  }

  if (failures.length) {
    console.log("  target split: FAIL");
    for (const failure of failures) console.log(`    - ${failure}`);
    return false;
  }

  console.log("  target split: PASS");
  return true;
}

function main() {
  const [, , filePath, ...dateParts] = process.argv;
  if (!filePath) {
    usage();
    process.exitCode = 1;
    return;
  }

  const assertTarget = dateParts.includes("--assert-target");
  const cleanDateParts = dateParts.filter((part) => part !== "--assert-target");
  const dateFilter = normalize(cleanDateParts.join(" "));
  const payload = payloadFrom(readJson(filePath));
  const days = Array.isArray(payload?.days) ? payload.days : [];
  const matchingDays = dateFilter ? days.filter((day) => normalize(day.date).includes(dateFilter)) : days;

  if (!matchingDays.length) {
    console.log(dateFilter ? `No day matched "${dateParts.join(" ")}".` : "No days found.");
    return;
  }

  let assertionPassed = true;
  for (const day of matchingDays) {
    const probes = Array.isArray(day.probe_debug) ? day.probe_debug : [];
    console.log(`\n${day.date || "Unknown date"}`);
    printDaySummary(day);
    if (assertTarget) assertionPassed = assertTargetSplit(day) && assertionPassed;
    if (!probes.length) {
      console.log("  No probe_debug rows found. Refresh ProPickle with the latest extension first.");
      continue;
    }

    for (const [time, timeProbes] of byTime(probes)) {
      const accepted = courtList(timeProbes, true);
      const rejected = courtList(timeProbes, false);
      console.log(`  ${time}`);
      console.log(`    accepted: ${accepted.length ? accepted.join(", ") : "none"}`);
      console.log(`    rejected: ${rejected.length ? rejected.join(", ") : "none"}`);
    }
  }

  if (assertTarget && !assertionPassed) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exitCode = 1;
}
