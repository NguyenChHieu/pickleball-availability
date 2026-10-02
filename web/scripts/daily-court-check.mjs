import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { AvailabilityRegistry } from "../../extension/venues.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TIME_ZONE = "Australia/Sydney";
const GUEST_VENUES = [
  "broadway",
  "sydneyracquet",
  "houseofpickle-darlingharbour",
  "wotso-pyrmont",
];
const READ_TIMEOUT_MS = 3 * 60 * 1000;

export function sydneyDate(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function validateRead(payload, venueId, today, probe = false) {
  if (payload?.venue_id !== venueId || !Array.isArray(payload.days) || !payload.days.length) {
    throw new Error("The reader returned no venue days.");
  }
  if (!probe && payload.days.length < 7) {
    throw new Error("The reader returned too few days for the shared cache.");
  }
  const dates = payload.days.map((day) => day.booking_date);
  if (dates[0] !== today || new Set(dates).size !== dates.length) {
    throw new Error("The reader returned the wrong dates.");
  }
  if (payload.days.every((day) => !day.open_intervals?.length)) {
    throw new Error("The reader returned no open intervals; keeping the last successful cache.");
  }
  return payload.days[0].open_intervals.length;
}

function cleanPayload(payload) {
  return {
    ...payload,
    days: payload.days.map((day) => {
      const clean = { ...day };
      delete clean.raw_slots;
      delete clean.probe_debug;
      return clean;
    }),
  };
}

function startUrl(venue, today) {
  if (venue.id !== "broadway") return venue.startUrl;
  return `${venue.bookingUrlBase}#?date=${today}&role=guest`;
}

async function readVenue(browser, venue, today, singleDay) {
  const context = await browser.newContext({ timezoneId: TIME_ZONE });
  try {
    const page = await context.newPage();
    const response = await page.goto(startUrl(venue, today), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (response && response.status() >= 400) throw new Error(`Venue page returned HTTP ${response.status()}.`);
    await page.addScriptTag({ path: path.join(ROOT, "extension", "providers", `${{
      broadway: "clubsparkBookByDate",
      sydneyracquet: "playtomicAvailability",
      "houseofpickle-darlingharbour": "podplayDom",
      "wotso-pyrmont": "hamletExperience",
    }[venue.id]}.js`) });
    await page.waitForFunction(
      (providerId) => Boolean(globalThis.AvailabilityProviders?.[providerId]?.canRead()),
      venue.providerId,
      { timeout: venue.readinessTimeoutMs || 15_000 }
    );
    const readerVenue = { ...venue, readDays: singleDay ? 1 : venue.readDays || 9 };
    let timeoutId;
    const payload = await Promise.race([
      page.evaluate((config) => globalThis.AvailabilityProviders[config.providerId].readAvailability(config), readerVenue),
      new Promise((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Venue read timed out.")), READ_TIMEOUT_MS);
      }),
    ]).finally(() => clearTimeout(timeoutId));
    validateRead(payload, venue.id, today, singleDay);
    return cleanPayload(payload);
  } finally {
    await context.close();
  }
}

async function backendRequest(baseUrl, token, route, options = {}) {
  const response = await fetch(new URL(route, baseUrl), {
    ...options,
    headers: {
      "x-sync-token": token,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Backend ${route} returned HTTP ${response.status}.`);
  return response.json();
}

async function runVenue(browser, venue, today, singleDay, backend) {
  const started = Date.now();
  const route = `/api/availability/${encodeURIComponent(venue.id)}`;
  let attempt;
  try {
    if (backend) {
      attempt = await backendRequest(backend.url, backend.token, `${route}/refresh-attempt`, { method: "POST" });
      if (!attempt?.attempt_id || !attempt?.started_at) throw new Error("Backend returned no refresh attempt.");
    }
    const payload = await readVenue(browser, venue, today, singleDay);
    let result = { accepted: true };
    if (backend) {
      const headers = {
        "x-refresh-attempt-id": attempt.attempt_id,
        "x-refresh-started-at": attempt.started_at,
      };
      result = await backendRequest(backend.url, backend.token, route, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (result?.ok !== true || typeof result.accepted !== "boolean") {
        throw new Error("Backend did not confirm the availability sync.");
      }
      try {
        await backendRequest(backend.url, backend.token, `${route}/refresh-status`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            status: result.accepted ? "success" : "cache_reused",
            duration_ms: Math.min(Date.now() - started, 1_800_000),
            source: "all",
          }),
        });
      } catch {
        console.error(`${venue.name}: availability synced, but refresh status could not be reported.`);
      }
    }
    const todayIntervals = payload.days[0].open_intervals
      .map((interval) => `${interval.start_time}-${interval.end_time}`)
      .join(", ");
    const courts = (payload.days[0].same_court_intervals || [])
      .map((court) => `${court.court_name || court.provider_name}: ${court.intervals.map((interval) => `${interval.start_time}-${interval.end_time}`).join(", ")}`)
      .join("; ");
    console.log(`${venue.name}: today ${todayIntervals || "no open intervals"}${courts ? ` | ${courts}` : ""}. ${payload.days.length} day(s) read${!backend ? " (dry run)" : result.accepted ? " and synced" : " (newer cache kept)"}.`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${venue.name}: ${message.slice(0, 180)}`);
    if (backend && attempt) {
      try {
        await backendRequest(backend.url, backend.token, `${route}/refresh-status`, {
          method: "POST",
          headers: {
            "x-refresh-attempt-id": attempt.attempt_id,
            "x-refresh-started-at": attempt.started_at,
          },
          body: JSON.stringify({
            status: /guest session|sign in|log in|login|setup/i.test(message) ? "setup_required" : "failed",
            duration_ms: Math.min(Date.now() - started, 1_800_000),
            source: "all",
          }),
        });
      } catch {
        console.error(`${venue.name}: could not report refresh status.`);
      }
    }
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const probe = args.includes("--probe");
  const dryRun = probe || args.includes("--dry-run");
  const venueIndex = args.indexOf("--venue");
  const selectedId = venueIndex >= 0 ? args[venueIndex + 1] : "";
  if (venueIndex >= 0 && !GUEST_VENUES.includes(selectedId)) {
    throw new Error("Unknown guest venue. Use --venue with a supported venue ID.");
  }
  const selected = (selectedId ? [selectedId] : GUEST_VENUES).map((id) => AvailabilityRegistry.getVenue(id));
  const url = process.env.AVAILABILITY_BACKEND_URL;
  const token = process.env.AVAILABILITY_SYNC_TOKEN;
  if (!dryRun && (!url || !token)) {
    throw new Error("Set AVAILABILITY_BACKEND_URL and AVAILABILITY_SYNC_TOKEN, or use --dry-run.");
  }
  const backend = dryRun ? null : { url: new URL(url).toString(), token };
  if (backend) {
    const parsed = new URL(backend.url);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) {
      throw new Error("The backend URL must use HTTPS outside local development.");
    }
  }
  const today = sydneyDate();
  console.log(`Checking guest venues for ${today} (${TIME_ZONE}). ProPickle and North Ryde need manual refresh.`);
  if (backend) {
    // This also makes a real Supabase read even when every guest venue is unavailable.
    try {
      await backendRequest(backend.url, backend.token, "/api/availability/propickle");
    } catch (error) {
      if (!String(error).includes("HTTP 404")) throw error;
    }
  }
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_BROWSER_CHANNEL ? { channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL } : {}),
  });
  try {
    let next = 0;
    const results = await Promise.all(
      Array.from({ length: Math.min(2, selected.length) }, async () => {
        const workerResults = [];
        while (next < selected.length) {
          const venue = selected[next++];
          workerResults.push(await runVenue(browser, venue, today, probe, backend));
        }
        return workerResults;
      })
    );
    if (results.flat().some((ok) => !ok)) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
