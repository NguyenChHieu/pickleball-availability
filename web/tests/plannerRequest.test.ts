import assert from "node:assert/strict";
import test from "node:test";

import {
  clientRateLimitKey,
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

test("rejects a declared Content-Length over the ceiling without reading the body", async () => {
  const request = new Request("https://example.com/api/planner/events", {
    method: "POST",
    body: "{}",
    headers: { "content-length": String(200_000) },
  });
  await assert.rejects(
    () => readPlannerRequestJson(request),
    (error: unknown) => error instanceof InvalidPlannerRequestError && /too large/i.test(error.message)
  );
});

test("rejects an empty body as invalid JSON rather than silently defaulting", async () => {
  const request = requestWithBody("");
  await assert.rejects(
    () => readPlannerRequestJson(request),
    (error: unknown) => error instanceof InvalidPlannerRequestError
  );
});

test("clientRateLimitKey prefers the first x-forwarded-for entry", () => {
  const request = new Request("https://example.com/api/planner/events", {
    headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
  });
  assert.equal(clientRateLimitKey(request), "203.0.113.5");
});

test("clientRateLimitKey falls back to x-real-ip when x-forwarded-for is absent", () => {
  const request = new Request("https://example.com/api/planner/events", {
    headers: { "x-real-ip": "203.0.113.9" },
  });
  assert.equal(clientRateLimitKey(request), "203.0.113.9");
});

test("clientRateLimitKey falls back to a shared bucket when no identifying header is present", () => {
  const request = new Request("https://example.com/api/planner/events");
  assert.equal(clientRateLimitKey(request), "unknown");
});
