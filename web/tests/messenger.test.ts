import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { extractIncomingMessages, verifyMessengerSignature, verifyWebhook } from "../src/server/messenger.ts";

function withEnv(overrides: Record<string, string | undefined>, run: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) previous[key] = process.env[key];
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("verifyMessengerSignature accepts a body signed with the configured app secret", () => {
  withEnv({ MESSENGER_APP_SECRET: "test-secret", VERCEL: undefined, RENDER: undefined }, () => {
    const body = JSON.stringify({ entry: [] });
    const signature = `sha256=${createHmac("sha256", "test-secret").update(body, "utf8").digest("hex")}`;
    assert.equal(verifyMessengerSignature(body, signature), true);
  });
});

test("verifyMessengerSignature rejects a body signed with the wrong secret", () => {
  withEnv({ MESSENGER_APP_SECRET: "test-secret", VERCEL: undefined, RENDER: undefined }, () => {
    const body = JSON.stringify({ entry: [] });
    const signature = `sha256=${createHmac("sha256", "wrong-secret").update(body, "utf8").digest("hex")}`;
    assert.equal(verifyMessengerSignature(body, signature), false);
  });
});

test("verifyMessengerSignature rejects a missing signature header", () => {
  withEnv({ MESSENGER_APP_SECRET: "test-secret", VERCEL: undefined, RENDER: undefined }, () => {
    assert.equal(verifyMessengerSignature("{}", null), false);
  });
});

test("verifyMessengerSignature requires the secret in deployed mode", () => {
  withEnv({ MESSENGER_APP_SECRET: undefined, VERCEL: "1", RENDER: undefined }, () => {
    assert.throws(() => verifyMessengerSignature("{}", null), /MESSENGER_APP_SECRET is required/);
  });
});

test("verifyMessengerSignature skips verification in local dev with no secret configured", () => {
  withEnv({ MESSENGER_APP_SECRET: undefined, VERCEL: undefined, RENDER: undefined }, () => {
    assert.equal(verifyMessengerSignature("{}", null), true);
  });
});

test("verifyWebhook rejects when no verify token is configured", () => {
  // MESSENGER_VERIFY_TOKEN is read once at module load, so this exercises the
  // real test-run default (unset) rather than a value set after import.
  const query = new URLSearchParams({
    "hub.mode": "subscribe",
    "hub.verify_token": "anything",
    "hub.challenge": "abc123",
  });
  assert.equal(verifyWebhook(query).ok, false);
});

test("extractIncomingMessages caps the number of messages read from one payload", () => {
  const messaging = Array.from({ length: 80 }, (_, index) => ({
    sender: { id: `user-${index}` },
    message: { text: "hi" },
  }));
  const messages = extractIncomingMessages({ entry: [{ messaging }] });
  assert.equal(messages.length, 50);
});
