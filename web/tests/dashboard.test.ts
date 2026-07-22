import assert from "node:assert/strict";
import test from "node:test";

import { getVenueDefinition } from "../src/lib/venues.ts";
import { buildDashboardVenue } from "../src/server/dashboard.ts";

const venue = getVenueDefinition("propickle");
if (!venue) throw new Error("ProPickle fixture venue is missing.");

test("dashboard venue exposes a compact fresh-cache summary", () => {
  const result = buildDashboardVenue(
    venue,
    {
      venue_id: "propickle",
      venue_name: "ProPickle",
      exported_at: "2026-07-23T09:58:00.000Z",
      days: [
        {
          date: "2026-07-24",
          remaining_hours: 2,
          open_intervals: [
            { start_time: "18:00", end_time: "19:00" },
            { start_time: "20:00", end_time: "21:00" },
          ],
        },
      ],
    },
    "2026-07-23T10:00:00.000Z"
  );

  assert.equal(result.state, "fresh");
  assert.equal(result.freshnessLabel, "Fresh 2m ago");
  assert.equal(result.dayCount, 1);
  assert.equal(result.totalOpenHours, 2);
  assert.equal(result.nextOpening, "18:00-19:00");
  assert.equal(result.platform, "Playbypoint");
});

test("dashboard venue marks old results stale", () => {
  const result = buildDashboardVenue(
    venue,
    {
      exported_at: "2026-07-23T09:45:00.000Z",
      days: [{ date: "2026-07-24", open_intervals: [] }],
    },
    "2026-07-23T10:00:00.000Z"
  );

  assert.equal(result.state, "stale");
  assert.equal(result.freshnessLabel, "Stale 15m ago");
  assert.equal(result.nextOpening, "No open intervals");
});

test("dashboard venue does not present legacy undated cache as fresh", () => {
  const result = buildDashboardVenue(
    venue,
    { days: [{ date: "2026-07-24", open_intervals: [] }] },
    "2026-07-23T10:00:00.000Z"
  );

  assert.equal(result.state, "stale");
});

test("dashboard venue keeps a usable empty state", () => {
  const result = buildDashboardVenue(venue, null, "2026-07-23T10:00:00.000Z");

  assert.equal(result.state, "empty");
  assert.equal(result.freshnessLabel, "No cache");
  assert.equal(result.dayCount, 0);
  assert.match(result.nextOpeningDetail, /first saved result/i);
  assert.match(result.fallbackUrl, /propickle/i);
});
