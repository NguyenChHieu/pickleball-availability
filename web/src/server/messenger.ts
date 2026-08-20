import { createHmac } from "node:crypto";

import { isHostedRuntime, timingSafeEqualStrings } from "./security.ts";

const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v24.0";
const PAGE_ACCESS_TOKEN = process.env.MESSENGER_PAGE_ACCESS_TOKEN || "";
const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN || "";
const MAX_INCOMING_MESSAGES = 50;

export function verifyWebhook(query: URLSearchParams) {
  const mode = query.get("hub.mode");
  const token = query.get("hub.verify_token");
  const challenge = query.get("hub.challenge");

  if (mode === "subscribe" && token && VERIFY_TOKEN && timingSafeEqualStrings(token, VERIFY_TOKEN)) {
    return { ok: true, challenge };
  }
  return { ok: false };
}

function configuredAppSecret() {
  const secret = process.env.MESSENGER_APP_SECRET || "";
  if (secret) return secret;
  if (isHostedRuntime()) throw new Error("MESSENGER_APP_SECRET is required in deployed mode.");
  return "";
}

/**
 * Verifies Meta's `X-Hub-Signature-256` header against the raw request body.
 * Deployed mode always requires MESSENGER_APP_SECRET (configuredAppSecret throws
 * otherwise); local dev without the secret set skips verification so the webhook
 * can still be exercised manually.
 */
export function verifyMessengerSignature(rawBody: string, signatureHeader: string | null) {
  const secret = configuredAppSecret();
  if (!secret) return true; // ponytail: dev-only bypass, see configuredAppSecret
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return timingSafeEqualStrings(signatureHeader.slice("sha256=".length), expected);
}

type MessengerBody = {
  entry?: Array<{
    messaging?: Array<{
      sender?: { id?: string };
      message?: { text?: string };
    }>;
  }>;
};

export function extractIncomingMessages(body: MessengerBody) {
  const messages: Array<{ senderId: string; text: string }> = [];
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      if (messages.length >= MAX_INCOMING_MESSAGES) return messages;
      const senderId = event.sender?.id;
      const text = event.message?.text;
      if (senderId && text) messages.push({ senderId, text });
    }
  }
  return messages;
}

export async function sendMessengerText(recipientId: string, text: string) {
  if (!PAGE_ACCESS_TOKEN) {
    console.log(`[messenger:dry-run] ${recipientId}: ${text}`);
    return { dryRun: true };
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${PAGE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Messenger Send API failed: ${response.status} ${body}`);
  }

  return response.json();
}
