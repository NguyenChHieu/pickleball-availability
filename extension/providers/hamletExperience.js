(() => {
  const providerId = "hamlet-experience";
  globalThis.AvailabilityProviders = globalThis.AvailabilityProviders || {};
  if (globalThis.AvailabilityProviders[providerId]) return;

  const DEFAULT_READ_DAYS = 9;
  const GRAPHQL_URL = "https://data.hamletapp.co/v1/graphql";
  const AUTH_REFRESH_URL = "https://api.hamletapp.co/v1/auth/refresh";

  const PUBLIC_MASTER_QUERY = `
    query pbb_wotso_public_master($location_id: uuid!, $item_ids: [uuid!]!) {
      locations(where: { location_id: { _eq: $location_id } }, limit: 1) {
        location_id
        name
        timezone
        open_hours
      }
      items(where: { item_id: { _in: $item_ids } }, order_by: { name: asc }) {
        item_id
        location_id
        name
        open_hours
        unit_price
        type
      }
    }
  `;

  const BOOKINGS_FOR_ITEMS_DAY_QUERY = `
    query pbb_wotso_bookings_for_items_day($item_ids: [uuid!]!, $start_time: timestamptz!, $end_time: timestamptz!) {
      bookings(
        order_by: { start_time: asc }
        where: {
          _and: [
            { item_id: { _in: $item_ids } }
            { start_time: { _lt: $end_time } }
            { end_time: { _gt: $start_time } }
          ]
        }
      ) {
        item_id
        booking_id
        end_time
        start_time
      }
    }
  `;

  const weekdayLong = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const normalizeWhitespace = (value) => (value || "").replace(/\s+/g, " ").trim();

  const localDateIso = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const dateFromIso = (dateIso) => {
    const match = String(dateIso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  };

  const addDays = (dateIso, offset) => {
    const date = dateFromIso(dateIso) || new Date();
    date.setDate(date.getDate() + offset);
    return localDateIso(date);
  };

  const dateLabel = (dateIso) => {
    const date = dateFromIso(dateIso);
    if (!date) return dateIso || "Unknown date";
    return `${weekdayLong[date.getDay()]}, ${monthNames[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")}`;
  };

  const datePartsFormatter = (timeZone) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      hour12: false,
    });

  const partsInZone = (date, timeZone) =>
    Object.fromEntries(
      datePartsFormatter(timeZone)
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );

  const dateIsoInZone = (date, timeZone) => {
    const parts = partsInZone(date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day}`;
  };

  const dateTimeInZone = (date, timeZone) => {
    const parts = partsInZone(date, timeZone);
    return {
      dateIso: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
    };
  };

  const timeToMinutes = (value) => {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) throw new Error(`Unsupported WOTSO time value: ${value}`);
    return Number(match[1]) * 60 + Number(match[2]);
  };

  const minutesToTime = (minutes) => {
    const wrapped = ((minutes % 1440) + 1440) % 1440;
    const hour = Math.floor(wrapped / 60);
    const minute = wrapped % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const parseMeridiemMinutes = (value) => {
    const match = normalizeWhitespace(value).match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridiem = match[3].toLowerCase();
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    return hour * 60 + minute;
  };

  const zonedDateTimeToUtcIso = (dateIso, minutes, timeZone) => {
    const date = dateFromIso(dateIso) || new Date();
    const utcGuess = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, minutes, 0, 0));
    const parts = partsInZone(utcGuess, timeZone);
    const zonedAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute)
    );
    return new Date(utcGuess.getTime() - (zonedAsUtc - utcGuess.getTime())).toISOString();
  };

  const tokenFromStorage = () => {
    const token = localStorage.getItem("portal_token_hamlet");
    return token && token !== "null" && token !== "undefined" ? token : "";
  };

  const refreshToken = async () => {
    try {
      const response = await fetch(AUTH_REFRESH_URL, {
        method: "POST",
        credentials: "include",
        headers: { accept: "application/json" },
      });
      if (!response.ok) return "";
      const body = await response.json();
      const token = body?.token || "";
      if (token) localStorage.setItem("portal_token_hamlet", token);
      return token;
    } catch {
      return "";
    }
  };

  const hamletToken = async () => tokenFromStorage() || refreshToken();

  const gql = async (query, variables) => {
    const token = await hamletToken();
    if (!token) {
      const error = new Error("WOTSO guest session is not ready yet. Open the WOTSO page and let it finish loading.");
      error.manualSetupRequired = true;
      throw error;
    }

    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`WOTSO GraphQL failed: ${response.status}`);

    const body = await response.json();
    if (body?.errors?.length) {
      const message = body.errors.map((error) => error.message).join("; ");
      const error = new Error(message);
      error.manualSetupRequired = /jwt|authorization|cookie|auth/i.test(message);
      throw error;
    }
    return body.data || {};
  };

  const openHoursForDate = (openHours, dateIso) => {
    const date = dateFromIso(dateIso);
    if (!date || !openHours) return null;

    const dayKey = weekdayLong[date.getDay()].toUpperCase();
    const setting = openHours?.[dayKey]?.NON_MEMBER || openHours?.[dayKey]?.MEMBER || openHours?.[dayKey];
    if (!setting?.open) return null;

    const start = parseMeridiemMinutes(setting.start);
    const end = parseMeridiemMinutes(setting.end);
    if (start === null || end === null) return null;
    return { start, end: end > start ? end : end + 24 * 60 };
  };

  const subtractBusy = (openInterval, busyIntervals) => {
    let available = [openInterval];
    for (const busy of busyIntervals) {
      available = available.flatMap((interval) => {
        if (busy.end <= interval.start || busy.start >= interval.end) return [interval];
        return [
          busy.start > interval.start ? { start: interval.start, end: Math.min(busy.start, interval.end) } : null,
          busy.end < interval.end ? { start: Math.max(busy.end, interval.start), end: interval.end } : null,
        ].filter(Boolean);
      });
    }
    return available.filter((interval) => interval.end > interval.start);
  };

  const mergeOpenIntervals = (slots) => {
    const intervals = slots
      .filter((slot) => slot.status === "open")
      .map((slot) => ({
        start: timeToMinutes(slot.start_time),
        end: timeToMinutes(slot.end_time),
      }))
      .filter((slot) => slot.end > slot.start)
      .sort((left, right) => left.start - right.start);

    const merged = [];
    for (const interval of intervals) {
      const previous = merged[merged.length - 1];
      if (!previous || interval.start > previous.end) merged.push({ ...interval });
      else previous.end = Math.max(previous.end, interval.end);
    }

    return merged.map((interval) => ({
      start_time: minutesToTime(interval.start),
      end_time: minutesToTime(interval.end),
    }));
  };

  const sameCourtIntervals = (slots) => {
    const byCourt = new Map();
    for (const slot of slots) {
      const courtName = normalizeWhitespace(slot.court_name || "");
      if (!courtName) continue;
      byCourt.set(courtName, [...(byCourt.get(courtName) || []), slot]);
    }

    return Array.from(byCourt.entries())
      .map(([courtName, courtSlots]) => ({
        court_name: courtName,
        intervals: mergeOpenIntervals(courtSlots),
      }))
      .filter((group) => group.intervals.length);
  };

  const remainingHours = (intervals) =>
    intervals.reduce(
      (sum, interval) => sum + (timeToMinutes(interval.end_time) - timeToMinutes(interval.start_time)) / 60,
      0
    );

  const bookingWindow = (dateIso, timeZone) => ({
    start: zonedDateTimeToUtcIso(dateIso, 0, timeZone),
    end: zonedDateTimeToUtcIso(dateIso, 24 * 60, timeZone),
  });

  const busyIntervalsForItem = (bookings, itemId, dateIso, timeZone) =>
    bookings
      .filter((booking) => booking.item_id === itemId)
      .map((booking) => {
        const start = dateTimeInZone(new Date(booking.start_time), timeZone);
        const end = dateTimeInZone(new Date(booking.end_time), timeZone);
        if (start.dateIso !== dateIso && end.dateIso !== dateIso) return null;
        const startMinutes = start.dateIso === dateIso ? timeToMinutes(start.time) : 0;
        const endMinutes = end.dateIso === dateIso ? timeToMinutes(end.time) : 24 * 60;
        return {
          start: startMinutes,
          end: endMinutes > startMinutes ? endMinutes : 24 * 60,
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.start - right.start);

  const fetchMaster = async (venue) => {
    const itemIds = venue.itemIds || [];
    const data = await gql(PUBLIC_MASTER_QUERY, {
      location_id: venue.locationId,
      item_ids: itemIds,
    });
    return {
      location: data.locations?.[0] || null,
      items: data.items || [],
    };
  };

  const fetchBookingsForDay = async (venue, dateIso, timeZone) => {
    const window = bookingWindow(dateIso, timeZone);
    const data = await gql(BOOKINGS_FOR_ITEMS_DAY_QUERY, {
      item_ids: venue.itemIds || [],
      start_time: window.start,
      end_time: window.end,
    });
    return data.bookings || [];
  };

  const slotsForDay = ({ items, bookings, dateIso, timeZone, locationOpenHours }) => {
    const slots = [];
    for (const item of items) {
      const open = openHoursForDate(item.open_hours || locationOpenHours, dateIso);
      if (!open) continue;

      const busy = busyIntervalsForItem(bookings, item.item_id, dateIso, timeZone);
      for (const interval of subtractBusy(open, busy)) {
        slots.push({
          title: item.name || "Pickleball court",
          date: dateLabel(dateIso),
          start_time: minutesToTime(interval.start),
          end_time: minutesToTime(interval.end),
          status: "open",
          price: item.unit_price ? `A$${Number(item.unit_price).toFixed(2)}` : "",
          resource_id: item.item_id,
          court_name: item.name || "Pickleball court",
        });
      }
    }
    return slots.sort((left, right) => timeToMinutes(left.start_time) - timeToMinutes(right.start_time));
  };

  const canRead = () => Boolean(tokenFromStorage()) || /wotso|pickleball|pyrmont/i.test(document.body?.innerText || "");
  const setupRequired = () => false;
  const selectDate = async () => true;

  async function readAvailability(venue = {}) {
    if (!venue.locationId || !venue.itemIds?.length) {
      throw new Error("WOTSO venue config is missing location or court ids.");
    }

    const master = await fetchMaster(venue);
    const timeZone = venue.timezone || master.location?.timezone || "Australia/Sydney";
    const readDays = Number(venue.readDays || DEFAULT_READ_DAYS);
    const startDate = dateIsoInZone(new Date(), timeZone);
    const bookingUrl = venue.publicBookingUrl || venue.startUrl || window.location.href;
    const itemById = new Map((master.items || []).map((item) => [item.item_id, item]));
    const items = (venue.itemIds || []).map((itemId) => itemById.get(itemId)).filter(Boolean);
    if (!items.length) throw new Error("WOTSO pickleball court items were not returned by Hamlet.");

    const days = [];
    for (let offset = 0; offset < readDays; offset += 1) {
      const dateIso = addDays(startDate, offset);
      const bookings = await fetchBookingsForDay(venue, dateIso, timeZone);
      const rawSlots = slotsForDay({
        items,
        bookings,
        dateIso,
        timeZone,
        locationOpenHours: master.location?.open_hours,
      });
      const openIntervals = mergeOpenIntervals(rawSlots);

      days.push({
        source_url: window.location.href,
        title: "Any pickleball court",
        date: dateLabel(dateIso),
        booking_date: dateIso,
        booking_url: bookingUrl,
        booking_action_url: bookingUrl,
        open_intervals: openIntervals,
        same_court_intervals: sameCourtIntervals(rawSlots),
        continuity_status: rawSlots.length ? "available" : "not_scanned",
        remaining_hours: remainingHours(openIntervals),
        raw_slots: rawSlots,
      });
    }

    return {
      exported_at: new Date().toISOString(),
      source_url: window.location.href,
      venue_id: venue.id || "wotso-pyrmont",
      venue_name: venue.name || "WOTSO Pickleball Pyrmont",
      provider_id: providerId,
      booking_url: bookingUrl,
      days,
    };
  }

  globalThis.AvailabilityProviders[providerId] = Object.freeze({
    providerId,
    canRead,
    setupRequired,
    selectDate,
    readAvailability,
  });
})();
