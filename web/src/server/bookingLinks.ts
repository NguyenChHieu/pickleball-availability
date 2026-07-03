export function stripHash(url: unknown) {
  if (!url) return "";
  try {
    const parsed = new URL(String(url));
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function bookingUrlForDay(day: Record<string, unknown> = {}, payload: Record<string, unknown> = {}) {
  return stripHash(payload.booking_url || day.booking_url || day.source_url || payload.source_url || "");
}

export function bookingActionUrlForDay(
  day: Record<string, unknown> = {},
  payload: Record<string, unknown> = {}
) {
  const bookingUrl = bookingUrlForDay(day, payload);
  if (!bookingUrl) return "";

  const bookingDate = String(day.booking_date || day.date || "");
  return bookingDate ? `${bookingUrl}#pbb_date=${encodeURIComponent(bookingDate)}` : bookingUrl;
}
