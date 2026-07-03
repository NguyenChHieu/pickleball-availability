const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v24.0";
const PAGE_ACCESS_TOKEN = process.env.MESSENGER_PAGE_ACCESS_TOKEN || "";
const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN || "";

export function verifyWebhook(query: URLSearchParams) {
  const mode = query.get("hub.mode");
  const token = query.get("hub.verify_token");
  const challenge = query.get("hub.challenge");

  if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
    return { ok: true, challenge };
  }
  return { ok: false };
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
  url.searchParams.set("access_token", PAGE_ACCESS_TOKEN);

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
