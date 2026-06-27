const http = require("node:http");
const { URL } = require("node:url");

const {
  getAllPayloads,
  getAvailabilityPayload,
  getAvailabilityRecord,
  saveAvailability,
} = require("./availabilityStore");
const { answerForMessage, formatAvailability } = require("./formatAvailability");
const { extractIncomingMessages, sendMessengerText, verifyWebhook } = require("./messenger");
const { renderSharePage } = require("./sharePage");

const PORT = Number(process.env.PORT || 8787);
const SYNC_TOKEN = process.env.AVAILABILITY_SYNC_TOKEN || "";
const SHARE_TOKEN = shareTokenFromEnv();

function shareTokenFromEnv() {
  if (process.env.SHARE_TOKEN) return process.env.SHARE_TOKEN;
  if (process.env.NODE_ENV === "production" || process.env.RENDER) {
    throw new Error("SHARE_TOKEN is required in deployed mode.");
  }
  return "dev-share";
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function sendText(response, status, body) {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
}

function sendHtml(response, status, body) {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(body);
}

function notFound(response) {
  sendJson(response, 404, { error: "Not found" });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        request.destroy();
        reject(new Error("Request body too large."));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function readJson(request) {
  const body = await readBody(request);
  if (!body.trim()) return {};
  return JSON.parse(body);
}

function requireSyncToken(request, response) {
  if (!SYNC_TOKEN) return true;
  if (request.headers["x-sync-token"] === SYNC_TOKEN) return true;
  sendJson(response, 401, { error: "Invalid sync token" });
  return false;
}

function venueFromApiPath(pathname, suffix = "") {
  const pattern = new RegExp(`^/api/availability/([^/]+)${suffix}$`);
  return pathname.match(pattern)?.[1] || "";
}

function decodePathSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function shareFromPath(pathname, suffix = "") {
  const pattern = new RegExp(`^/s/([^/]+)/([^/]+)${suffix}$`);
  const match = pathname.match(pattern);
  if (!match) return null;
  const shareToken = decodePathSegment(match[1]);
  const venueId = decodePathSegment(match[2]);
  if (!shareToken || !venueId) return null;
  return {
    shareToken,
    venueId,
  };
}

function validShareToken(shareToken) {
  return Boolean(SHARE_TOKEN && shareToken && shareToken === SHARE_TOKEN);
}

async function handleAvailabilityPost(request, response, venueId) {
  if (!requireSyncToken(request, response)) return;

  const payload = await readJson(request);
  const record = await saveAvailability(venueId, payload);
  sendJson(response, 200, {
    ok: true,
    venue_id: record.venue_id,
    received_at: record.received_at,
  });
}

async function handleAvailabilityGet(_request, response, venueId) {
  const record = await getAvailabilityRecord(venueId);
  if (!record) {
    sendJson(response, 404, { error: `No cached availability for ${venueId}` });
    return;
  }
  sendJson(response, 200, record);
}

async function handleAvailabilitySummary(_request, response, venueId) {
  const payload = await getAvailabilityPayload(venueId);
  sendText(response, payload ? 200 : 404, formatAvailability(payload));
}

async function handleSharePage(response, shareToken, venueId) {
  if (!validShareToken(shareToken)) {
    notFound(response);
    return;
  }

  const payload = await getAvailabilityPayload(venueId);
  sendHtml(response, 200, renderSharePage(payload, { venueId }));
}

async function handleShareText(response, shareToken, venueId) {
  if (!validShareToken(shareToken)) {
    notFound(response);
    return;
  }

  const payload = await getAvailabilityPayload(venueId);
  sendText(response, payload ? 200 : 404, formatAvailability(payload));
}

async function handleMessengerGet(url, response) {
  const verification = verifyWebhook(url.searchParams);
  if (!verification.ok) {
    sendText(response, 403, "Forbidden");
    return;
  }
  sendText(response, 200, verification.challenge || "");
}

async function handleMessengerPost(request, response) {
  const body = await readJson(request);
  const payloadsByVenue = await getAllPayloads();
  const messages = extractIncomingMessages(body);

  await Promise.all(
    messages.map((message) =>
      sendMessengerText(message.senderId, answerForMessage(message.text, payloadsByVenue))
    )
  );

  sendJson(response, 200, { ok: true, handled: messages.length });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = url.pathname;

  try {
    if (request.method === "GET" && pathname === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    const shareText = shareFromPath(pathname, "/text");
    if (request.method === "GET" && shareText) {
      await handleShareText(response, shareText.shareToken, shareText.venueId);
      return;
    }

    const sharePage = shareFromPath(pathname);
    if (request.method === "GET" && sharePage) {
      await handleSharePage(response, sharePage.shareToken, sharePage.venueId);
      return;
    }

    const summaryVenue = venueFromApiPath(pathname, "/summary");
    if (request.method === "GET" && summaryVenue) {
      await handleAvailabilitySummary(request, response, summaryVenue);
      return;
    }

    const venueId = venueFromApiPath(pathname);
    if (request.method === "POST" && venueId) {
      await handleAvailabilityPost(request, response, venueId);
      return;
    }
    if (request.method === "GET" && venueId) {
      await handleAvailabilityGet(request, response, venueId);
      return;
    }

    if (pathname === "/webhook/messenger" && request.method === "GET") {
      await handleMessengerGet(url, response);
      return;
    }
    if (pathname === "/webhook/messenger" && request.method === "POST") {
      await handleMessengerPost(request, response);
      return;
    }

    notFound(response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: error?.message || String(error) });
  }
}

const server = http.createServer((request, response) => {
  handleRequest(request, response);
});

server.listen(PORT, () => {
  console.log(`Availability bot server listening on http://localhost:${PORT}`);
});
