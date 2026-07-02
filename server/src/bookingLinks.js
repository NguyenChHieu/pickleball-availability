function stripHash(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function bookingUrlForDay(day, payload) {
  return stripHash(payload?.booking_url || day?.booking_url || day?.source_url || payload?.source_url || "");
}

function bookingActionUrlForDay(day, payload) {
  const bookingUrl = bookingUrlForDay(day, payload);
  if (!bookingUrl) return "";

  const bookingDate = day?.booking_date || day?.date || "";
  return bookingDate ? `${bookingUrl}#pbb_date=${encodeURIComponent(bookingDate)}` : bookingUrl;
}

module.exports = {
  bookingActionUrlForDay,
  bookingUrlForDay,
  stripHash,
};
