#!/usr/bin/env node

const fs = require("node:fs");
const { targetSplitFailures } = require("../extension/probeTargetSplit");

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

function assertTargetSplit(day) {
  const failures = targetSplitFailures(day);
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
