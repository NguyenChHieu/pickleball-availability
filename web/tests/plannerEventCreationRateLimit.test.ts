import assert from "node:assert/strict";
import { after, test } from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "test-secret";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const originalFetch = globalThis.fetch;

let nextRpcResponse: { status: number; body: unknown } = {
  status: 200,
  body: { allowed: true, retryAfterSeconds: 0 },
};
let lastRpcRequestBody: unknown = null;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

globalThis.fetch = async (input, init) => {
  const url = String(input);

  if (url.includes("/rpc/planner_event_creation_check_and_record")) {
    lastRpcRequestBody = init?.body ? JSON.parse(String(init.body)) : null;
    return jsonResponse(nextRpcResponse.body, nextRpcResponse.status);
  }
  if (url.includes("planner_events") || url.includes("planner_event_venues")) {
    return jsonResponse([], 201);
  }
  return jsonResponse([]);
};

const { createPlannerEvent, PlannerEventCreationRateLimitError } = await import(
  "../src/server/plannerStore.ts"
);

after(() => {
  globalThis.fetch = originalFetch;
});

function eventInput() {
  return {
    name: "Friday hit",
    dateStart: "2026-07-10",
    dateEnd: "2026-07-10",
    preferredStartTime: "18:00",
    preferredEndTime: "22:00",
    minimumDurationMinutes: 60,
    venueIds: ["propickle"],
  };
}

test("an allowed RPC response lets creation through and sends the client key as the attempt key", async () => {
  nextRpcResponse = { status: 200, body: { allowed: true, retryAfterSeconds: 0 } };
  const event = await createPlannerEvent(eventInput(), "203.0.113.5");
  assert.ok(event.eventToken);
  assert.deepEqual(lastRpcRequestBody, { p_attempt_key: "203.0.113.5" });
});

test("a blocked RPC response rejects with the server-issued retry delay", async () => {
  nextRpcResponse = { status: 200, body: { allowed: false, retryAfterSeconds: 42 } };
  await assert.rejects(
    createPlannerEvent(eventInput(), "203.0.113.5"),
    (error: unknown) => error instanceof PlannerEventCreationRateLimitError && error.retryAfterSeconds === 42
  );
});

test("a missing rate-limit migration fails closed with a clear operator-facing error", async () => {
  nextRpcResponse = {
    status: 404,
    body: {
      code: "PGRST202",
      message: "Could not find the function public.planner_event_creation_check_and_record",
    },
  };
  await assert.rejects(createPlannerEvent(eventInput(), "203.0.113.5"), /Supabase migration/);
});
