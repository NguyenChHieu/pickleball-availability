import assert from "node:assert/strict";
import test from "node:test";

import {
  API_CORS_HEADERS,
  API_RESPONSE_HEADERS,
  NO_STORE_HEADERS,
  apiPreflight,
  timingSafeEqualStrings,
} from "../src/server/security.ts";

test("protected API responses are private and never cached", () => {
  assert.equal(API_RESPONSE_HEADERS["cache-control"], "private, no-store, max-age=0");
  assert.equal(API_RESPONSE_HEADERS["access-control-allow-origin"], "*");
  assert.equal(API_RESPONSE_HEADERS["referrer-policy"], "no-referrer");
  assert.equal(API_RESPONSE_HEADERS["x-robots-tag"], "noindex, nofollow, noarchive");
});

test("CORS preflight remains separately cacheable and contains no response data policy", () => {
  const response = apiPreflight();
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-max-age"), "86400");
  assert.equal(response.headers.get("cache-control"), null);
  assert.equal(Object.hasOwn(API_CORS_HEADERS, "cache-control"), false);
  assert.equal(NO_STORE_HEADERS["cache-control"], "private, no-store, max-age=0");
});

test("timingSafeEqualStrings matches equal strings", () => {
  assert.equal(timingSafeEqualStrings("dev-share", "dev-share"), true);
});

test("timingSafeEqualStrings rejects different strings of the same length", () => {
  assert.equal(timingSafeEqualStrings("dev-share", "dev-sharx"), false);
});

test("timingSafeEqualStrings rejects strings of different length without throwing", () => {
  assert.equal(timingSafeEqualStrings("short", "a-much-longer-value"), false);
});
