const MAX_BODY_BYTES = 64 * 1024;

export class InvalidPlannerRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPlannerRequestError";
  }
}

function invalid(message: string): never {
  throw new InvalidPlannerRequestError(message);
}

/**
 * Reads and parses a planner request body with a byte-size ceiling. A declared
 * Content-Length over the ceiling is rejected before the body is read at all;
 * a body that lies about its length (or omits Content-Length) is still caught
 * after buffering, as a backstop. Field-level bounds (name length, date
 * ranges, block counts, etc.) remain the responsibility of plannerStore.
 */
export async function readPlannerRequestJson(request: Request): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get("content-length") || "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    invalid("Request body is too large.");
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    invalid("Request body is too large.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    invalid("Request body must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    invalid("Request body must be an object.");
  }

  return parsed as Record<string, unknown>;
}

/**
 * Best-effort caller identifier for rate limiting, not authentication. On
 * Vercel, x-forwarded-for's first entry is the original client; x-real-ip is
 * a fallback for other proxies. Requests with neither (e.g. local dev without
 * a proxy in front) share one "unknown" bucket rather than bypassing the
 * limiter entirely.
 */
export function clientRateLimitKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();
  if (firstForwarded) return firstForwarded;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}
