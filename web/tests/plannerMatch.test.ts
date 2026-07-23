import assert from "node:assert/strict";
import test from "node:test";
import { buildPlannerRecommendations, mergeBlocks } from "../src/server/plannerMatch.ts";
import type { PlannerEvent, PlannerParticipant, PlannerVenueAvailability } from "../src/server/plannerTypes.ts";

const event: PlannerEvent = {
  eventToken: "event",
  name: "Test hit",
  dateStart: "2026-07-10",
  dateEnd: "2026-07-10",
  preferredStartTime: "18:00",
  preferredEndTime: "22:00",
  minimumDurationMinutes: 60,
  venueIds: ["propickle"],
  createdAt: "2026-07-10T00:00:00.000Z",
};

function participant(
  participantId: string,
  displayName: string,
  startMinute: number,
  endMinute: number
): PlannerParticipant {
  return {
    participantId,
    eventToken: event.eventToken,
    displayName,
    displayNameKey: displayName.toLowerCase(),
    editToken: `${participantId}-edit`,
    createdAt: event.createdAt,
    availabilityBlocks: [{ date: "2026-07-10", startMinute, endMinute }],
  };
}

function venue(
  intervals: PlannerVenueAvailability["days"][number]["intervals"],
  overrides: Partial<PlannerVenueAvailability> = {}
): PlannerVenueAvailability {
  return {
    venueId: "propickle",
    venueName: "ProPickle",
    fallbackUrl: "https://example.com",
    lastReadAt: "2026-07-10T08:00:00.000Z",
    freshnessLabel: "10 Jul 2026, 6:00 pm",
    isStale: false,
    staleThresholdMinutes: 5,
    refreshHealth: {
      status: "unknown",
      attemptedAt: null,
      hasNewerIssue: false,
      message: "",
    },
    state: "ready",
    days: [{ date: "2026-07-10", intervals }],
    ...overrides,
  };
}

test("planner recommendations rank bigger group overlap first", () => {
  const recommendations = buildPlannerRecommendations(
    event,
    [participant("p1", "Hieu", 18 * 60, 21 * 60), participant("p2", "Alex", 19 * 60, 20 * 60)],
    [
      venue([
        { startMinute: 18 * 60, endMinute: 19 * 60, confidence: "same-court", courtName: "Court 1" },
        { startMinute: 19 * 60, endMinute: 20 * 60, confidence: "same-court", courtName: "Court 1" },
      ]),
    ]
  );

  assert.equal(recommendations[0].startMinute, 19 * 60);
  assert.equal(recommendations[0].availableParticipantCount, 2);
  assert.deepEqual(recommendations[0].availableParticipantNames, ["Hieu", "Alex"]);
  assert.equal(recommendations[0].confidence, "same-court");
  assert.equal(recommendations[0].courtName, "Court 1");
});

test("planner recommendations filter intervals shorter than the minimum session", () => {
  const recommendations = buildPlannerRecommendations(
    event,
    [participant("p1", "Hieu", 18 * 60, 19 * 60)],
    [venue([{ startMinute: 18 * 60, endMinute: 18 * 60 + 30, confidence: "same-court", courtName: "Court 1" }])]
  );

  assert.equal(recommendations.length, 0);
});

test("planner recommendations collapse adjacent courts into one venue window", () => {
  const recommendations = buildPlannerRecommendations(
    event,
    [participant("p1", "Hieu", 19 * 60, 20 * 60)],
    [
      venue([
        { startMinute: 19 * 60, endMinute: 19 * 60 + 30, confidence: "same-court", courtName: "Court 1" },
        { startMinute: 19 * 60 + 30, endMinute: 20 * 60, confidence: "same-court", courtName: "Court 2" },
      ]),
    ]
  );

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].venueName, "ProPickle");
  assert.equal(recommendations[0].startMinute, 19 * 60);
  assert.equal(recommendations[0].endMinute, 20 * 60);
  assert.equal(recommendations[0].confidence, "any-court");
});

test("planner recommendations keep court continuity as venue confidence", () => {
  const recommendations = buildPlannerRecommendations(
    event,
    [participant("p1", "Hieu", 19 * 60, 20 * 60)],
    [
      venue([
        { startMinute: 18 * 60, endMinute: 21 * 60, confidence: "any-court" },
        { startMinute: 19 * 60, endMinute: 20 * 60, confidence: "same-court", courtName: "Court 4" },
      ]),
    ]
  );

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].confidence, "same-court");
  assert.equal(recommendations[0].courtName, "Court 4");
});

test("planner recommendations prefer fresh venue cache over stale cache when overlap is tied", () => {
  const recommendations = buildPlannerRecommendations(
    event,
    [participant("p1", "Hieu", 18 * 60, 21 * 60)],
    [
      venue([{ startMinute: 18 * 60, endMinute: 19 * 60, confidence: "same-court", courtName: "Court 1" }], {
        venueId: "stale",
        venueName: "Stale Venue",
        isStale: true,
      }),
      venue([{ startMinute: 19 * 60, endMinute: 20 * 60, confidence: "same-court", courtName: "Court 2" }], {
        venueId: "fresh",
        venueName: "Fresh Venue",
        isStale: false,
      }),
    ]
  );

  assert.equal(recommendations[0].venueId, "fresh");
});

test("planner recommendations carry refresh warnings without changing matches", () => {
  const recommendations = buildPlannerRecommendations(
    event,
    [participant("p1", "Hieu", 18 * 60, 20 * 60)],
    [
      venue([{ startMinute: 18 * 60, endMinute: 19 * 60, confidence: "any-court" }], {
        refreshHealth: {
          status: "failed",
          attemptedAt: "2026-07-10T09:00:00.000Z",
          hasNewerIssue: true,
          message: "Refresh failed. Showing the last successful read.",
        },
      }),
    ]
  );

  assert.equal(recommendations.length, 1);
  assert.match(recommendations[0].refreshMessage, /Refresh failed/);
});

test("planner recommendations prefer same-court confidence when people and freshness are tied", () => {
  const recommendations = buildPlannerRecommendations(
    event,
    [participant("p1", "Hieu", 18 * 60, 21 * 60)],
    [
      venue([{ startMinute: 18 * 60, endMinute: 19 * 60, confidence: "any-court" }], {
        venueId: "any-court",
        venueName: "Any Court Venue",
      }),
      venue([{ startMinute: 19 * 60, endMinute: 20 * 60, confidence: "same-court", courtName: "Court 2" }], {
        venueId: "same-court",
        venueName: "Same Court Venue",
      }),
    ]
  );

  assert.equal(recommendations[0].venueId, "same-court");
  assert.equal(recommendations[0].confidence, "same-court");
});

test("planner recommendations handle missing venue availability", () => {
  const recommendations = buildPlannerRecommendations(event, [participant("p1", "Hieu", 18 * 60, 21 * 60)], [
    venue([], { state: "empty", days: [] }),
  ]);

  assert.deepEqual(recommendations, []);
});

test("mergeBlocks joins adjacent participant cells", () => {
  assert.deepEqual(
    mergeBlocks([
      { date: "2026-07-10", startMinute: 18 * 60 + 30, endMinute: 19 * 60 },
      { date: "2026-07-10", startMinute: 18 * 60, endMinute: 18 * 60 + 30 },
      { date: "2026-07-10", startMinute: 20 * 60, endMinute: 21 * 60 },
    ]),
    [
      { date: "2026-07-10", startMinute: 18 * 60, endMinute: 19 * 60 },
      { date: "2026-07-10", startMinute: 20 * 60, endMinute: 21 * 60 },
    ]
  );
});
