import { getAllPayloads } from "@/server/availabilityStore";
import { answerForMessage } from "@/server/formatAvailability";
import { extractIncomingMessages, sendMessengerText, verifyWebhook } from "@/server/messenger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const body = await request.json();
  const payloadsByVenue = await getAllPayloads();
  const messages = extractIncomingMessages(body);

  await Promise.all(
    messages.map((message) =>
      sendMessengerText(message.senderId, answerForMessage(message.text, payloadsByVenue))
    )
  );

  return Response.json({ ok: true, handled: messages.length });
}
