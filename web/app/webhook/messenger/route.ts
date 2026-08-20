import { getAllPayloads } from "@/server/availabilityStore";
import { answerForMessage } from "@/server/formatAvailability";
import {
  extractIncomingMessages,
  sendMessengerText,
  verifyMessengerSignature,
  verifyWebhook,
} from "@/server/messenger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Meta webhook deliveries are small JSON events; this is generous headroom, not a real-world size.
const MAX_BODY_BYTES = 1 * 1024 * 1024;

export function GET(request: Request) {
  const url = new URL(request.url);
  const verification = verifyWebhook(url.searchParams);
  if (!verification.ok) return new Response("Forbidden", { status: 403 });
  return new Response(verification.challenge || "", {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }
  if (!verifyMessengerSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("Forbidden", { status: 403 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const messages = extractIncomingMessages(body as Parameters<typeof extractIncomingMessages>[0]);
  if (!messages.length) return Response.json({ ok: true, handled: 0 });

  const payloadsByVenue = await getAllPayloads();
  await Promise.all(
    messages.map((message) =>
      sendMessengerText(message.senderId, answerForMessage(message.text, payloadsByVenue))
    )
  );

  return Response.json({ ok: true, handled: messages.length });
}
