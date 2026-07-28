import assert from "node:assert/strict";
import test from "node:test";

import {
  InvalidPlannerRequestError,
  readPlannerRequestJson,
} from "../src/server/plannerRequest.ts";

function requestWithBody(body: string) {
  return new Request("https://example.com/api/planner/events", {
    method: "POST",
    body,
  });
}

test("accepts a small valid JSON object and returns it parsed", async () => {
  const request = requestWithBody(JSON.stringify({ name: "Friday session", venueIds: ["propickle"] }));
  const parsed = await readPlannerRequestJson(request);
  assert.deepEqual(parsed, { name: "Friday session", venueIds: ["propickle"] });
});

test("rejects a body over the size ceiling before parsing", async () => {
  const hugeName = "a".repeat(80_000);
  const request = requestWithBody(JSON.stringify({ name: hugeName }));
  await assert.rejects(
    () => readPlannerRequestJson(request),
    (error: unknown) => error instanceof InvalidPlannerRequestError && /too large/i.test(error.message)
  );
});

test("rejects malformed JSON", async () => {
  const request = requestWithBody("{ not json");
  await assert.rejects(
    () => readPlannerRequestJson(request),
    (error: unknown) => error instanceof InvalidPlannerRequestError && /valid JSON/i.test(error.message)
  );
});

test("rejects JSON that is not a plain object", async () => {
  for (const body of ['[1,2,3]', '"just a string"', "42", "null", "true"]) {
    const request = requestWithBody(body);
    await assert.rejects(
      () => readPlannerRequestJson(request),
      (error: unknown) => error instanceof InvalidPlannerRequestError && /must be an object/i.test(error.message)
    );
  }
});

test("rejects an empty body as invalid JSON rather than silently defaulting", async () => {
  const request = requestWithBody("");
  await assert.rejects(
    () => readPlannerRequestJson(request),
    (error: unknown) => error instanceof InvalidPlannerRequestError
  );
});
