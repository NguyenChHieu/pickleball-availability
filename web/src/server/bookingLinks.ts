export function stripHash(url: unknown) {
  return safeHttpUrl(url, { stripHash: true });
}

function safeHttpUrl(url: unknown, { stripHash: shouldStripHash } = { stripHash: false }) {
  if (!url) return "";
  try {
    const parsed = new URL(String(url));
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    if (shouldStripHash) parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function bookingUrlForDay(day: Record<string, unknown> = {}, payload: Record<string, unknown> = {}) {
  return stripHash(day.booking_url || payload.booking_url || day.source_url || payload.source_url || "");
}

export function bookingActionUrlForDay(
  day: Record<string, unknown> = {},
  payload: Record<string, unknown> = {}
) {
  const explicitActionUrl = safeHttpUrl(day.booking_action_url || day.bookingActionUrl, { stripHash: false });
  if (explicitActionUrl) return explicitActionUrl;

  const bookingUrl = bookingUrlForDay(day, payload);
  if (!bookingUrl) return "";

  const bookingDate = String(day.booking_date || day.date || "");
  return bookingDate ? `${bookingUrl}#pbb_date=${encodeURIComponent(bookingDate)}` : bookingUrl;
}
