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
 * Reads and parses a planner request body with a byte-size ceiling enforced
 * before JSON.parse runs, so an oversized body is rejected cheaply instead of
 * being fully buffered and parsed. Field-level bounds (name length, date
 * ranges, block counts, etc.) remain the responsibility of plannerStore.
 */
export async function readPlannerRequestJson(request: Request): Promise<Record<string, unknown>> {
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
