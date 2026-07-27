export const API_CORS_HEADERS = Object.freeze({
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers":
    "content-type, x-sync-token, x-refresh-attempt-id, x-refresh-started-at",
  "access-control-max-age": "86400",
});

export const NO_STORE_HEADERS = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

export const API_RESPONSE_HEADERS = Object.freeze({
  ...API_CORS_HEADERS,
  ...NO_STORE_HEADERS,
});

function isHostedRuntime() {
  return Boolean(process.env.VERCEL || process.env.RENDER);
}

function configuredShareToken() {
  const token = process.env.SHARE_TOKEN || "";
  if (token) return token;
  if (isHostedRuntime()) throw new Error("SHARE_TOKEN is required in deployed mode.");
  return "dev-share";
}

function configuredSyncToken() {
  const token = process.env.AVAILABILITY_SYNC_TOKEN || "";
  if (token) return token;
  if (isHostedRuntime()) throw new Error("AVAILABILITY_SYNC_TOKEN is required in deployed mode.");
  return "";
}

export function validShareToken(shareToken: string) {
  const token = configuredShareToken();
  return Boolean(token && shareToken && shareToken === token);
}

export function requireSyncToken(request: Request) {
  const token = configuredSyncToken();
  if (!token) return null;
  if (request.headers.get("x-sync-token") === token) return null;
  return Response.json(
    { error: "Invalid sync token" },
    {
      status: 401,
      headers: API_RESPONSE_HEADERS,
    }
  );
}

export function apiPreflight() {
  return new Response(null, {
    status: 204,
    headers: API_CORS_HEADERS,
  });
}

export function notFoundJson(headers?: HeadersInit) {
  return Response.json(
    { error: "Not found" },
    {
      status: 404,
      headers,
    }
  );
}
