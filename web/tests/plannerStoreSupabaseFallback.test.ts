import assert from "node:assert/strict";
import { after, test } from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "test-secret";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const originalFetch = globalThis.fetch;
const requestedUrls: string[] = [];

globalThis.fetch = async (input) => {
  const url = String(input);
  requestedUrls.push(url);

  if (url.includes("planner_events")) {
    return jsonResponse([
      {
        event_token: "event",
        name: "Friday hit",
        date_start: "2026-07-10",
        date_end: "2026-07-10",
        preferred_start_time: "18:00",
        preferred_end_time: "22:00",
        minimum_duration_minutes: 60,
        created_at: "2026-07-10T00:00:00.000Z",
      },
    ]);
  }

  if (url.includes("planner_event_venues")) {
    return jsonResponse([{ venue_id: "propickle" }]);
  }

  if (url.includes("planner_participants") && url.includes("display_name_key")) {
    return jsonResponse(
      { code: "42703", message: "column planner_participants.display_name_key does not exist" },
      400
    );
  }

  if (url.includes("planner_participants") && url.includes("select=participant_id")) {
    return jsonResponse([
      {
        participant_id: "participant",
        display_name: "Hieu",
        edit_token: "edit",
        created_at: "2026-07-10T00:00:00.000Z",
      },
    ]);
  }

  if (url.includes("planner_participants")) {
    return jsonResponse(
      { code: "42703", message: "column planner_participants.edit_password_hash does not exist" },
      400
    );
  }

  if (url.includes("planner_availability_blocks")) {
    return jsonResponse([
      {
        participant_id: "participant",
        date: "2026-07-10",
        start_minute: 18 * 60,
        end_minute: 20 * 60,
      },
    ]);
  }

  if (url.includes("availability_cache")) {
    return jsonResponse([]);
  }

  return jsonResponse([]);
};

const { getPlannerEventView, upsertPlannerParticipant } = await import(
  `../src/server/plannerStore.ts?supabaseFallback=${Date.now()}`
);

after(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("planner event view falls back when password columns are not migrated yet", async () => {
  const view = await getPlannerEventView("event");

  assert.equal(view?.event.eventToken, "event");
  assert.equal(view?.participants[0]?.displayName, "Hieu");
  assert.equal(view?.participants[0] && "editToken" in view.participants[0], false);
  assert.ok(requestedUrls.some((url) => url.includes("display_name_key")));
});

test("participant save gives a clear migration error when password columns are missing", async () => {
  await assert.rejects(
    upsertPlannerParticipant("event", {
      displayName: "Alex",
      editPassword: "court123",
      availabilityBlocks: [{ date: "2026-07-10", startMinute: 18 * 60, endMinute: 20 * 60 }],
    }),
    /latest Supabase migration/
  );
});
