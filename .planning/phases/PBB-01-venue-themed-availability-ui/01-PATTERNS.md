# Phase 1: Venue-Themed Availability UI - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 19
**Analogs found:** 19 / 19

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `server/src/index.js` | route/controller | request-response | `server/src/index.js` | exact |
| `server/src/publicAvailability.js` | service/utility | transform + request-response DTO | `server/src/sharePage.js`, `server/src/formatAvailability.js` | role-match |
| `server/src/bookingLinks.js` | utility | transform | `server/src/sharePage.js` | exact |
| `server/src/sharePage.js` | component/renderer | transform | `server/src/sharePage.js` | exact |
| `server/src/formatAvailability.js` | utility | transform | `server/src/formatAvailability.js` | exact |
| `server/package.json` | config | batch/check script | `server/package.json` | exact |
| `web/package.json` | config | batch/scripts | `server/package.json` | partial |
| `web/next.config.ts` | config | request-response frontend config | no existing web app | no analog |
| `web/tsconfig.json` | config | build/typecheck | no existing TypeScript app | no analog |
| `web/.env.example` | config | request-response endpoint config | `server/src/index.js` env fallback style | partial |
| `web/app/layout.tsx` | provider/layout | request-response SSR | no existing web app | no analog |
| `web/app/globals.css` | component/style | transform/rendering | `server/src/sharePage.js` inline CSS | role-match |
| `web/app/s/[shareToken]/[venueId]/page.tsx` | route/component | request-response | `server/src/index.js`, `server/src/sharePage.js` | role-match |
| `web/app/s/[shareToken]/[venueId]/loading.tsx` | component | request-response loading state | `server/src/sharePage.js` empty-state markup | partial |
| `web/app/s/[shareToken]/[venueId]/not-found.tsx` | component | request-response error state | `server/src/index.js` `notFound`, `server/src/sharePage.js` empty-state markup | partial |
| `web/src/lib/publicAvailability.ts` | service | request-response fetch + DTO mapping | `server/src/index.js`, `server/src/availabilityStore.js` | role-match |
| `web/src/lib/themes.ts` | utility/config | transform | `extension/venues.js` | partial metadata-only |
| `web/src/components/AvailabilityPage.tsx` | component | transform/rendering | `server/src/sharePage.js` | role-match |
| `web/src/components/DayCard.tsx` | component | transform/rendering | `server/src/sharePage.js` | exact semantics |
| `web/src/components/HeroScene.tsx` | component | event-driven/client motion | no existing motion/canvas code | no analog |

## Pattern Assignments

### `server/src/index.js` (route/controller, request-response)

**Analog:** `server/src/index.js`

**Imports pattern** (lines 1-12):
```javascript
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
```

**JSON/CORS response pattern** (lines 17-22, 45-69):
```javascript
const API_CORS_HEADERS = Object.freeze({
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-sync-token",
  "access-control-max-age": "86400",
});

function sendApiJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json",
    ...API_CORS_HEADERS,
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function sendApiPreflight(response) {
  response.writeHead(204, API_CORS_HEADERS);
  response.end();
}
```

**Share-token guard pattern** (lines 125-140, 172-180):
```javascript
function shareFromPath(pathname, suffix = "") {
  const pattern = new RegExp(`^/s/([^/]+)/([^/]+)${suffix}$`);
  const match = pathname.match(pattern);
  if (!match) return null;
  const shareToken = decodePathSegment(match[1]);
  const venueId = decodePathSegment(match[2]);
  if (!shareToken || !venueId) return null;
  return { shareToken, venueId };
}

function validShareToken(shareToken) {
  return Boolean(SHARE_TOKEN && shareToken && shareToken === SHARE_TOKEN);
}

async function handleSharePage(response, shareToken, venueId) {
  if (!validShareToken(shareToken)) {
    notFound(response);
    return;
  }

  const payload = await getAvailabilityPayload(venueId);
  sendHtml(response, 200, renderSharePage(payload, { venueId }));
}
```

**Router pattern** (lines 215-256):
```javascript
async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = url.pathname;

  try {
    if (request.method === "OPTIONS" && pathname.startsWith("/api/availability/")) {
      sendApiPreflight(response);
      return;
    }

    const sharePage = shareFromPath(pathname);
    if (request.method === "GET" && sharePage) {
      await handleSharePage(response, sharePage.shareToken, sharePage.venueId);
      return;
    }

    const venueId = venueFromApiPath(pathname);
    if (request.method === "GET" && venueId) {
      await handleAvailabilityGet(request, response, venueId);
      return;
    }
```

**Error handling pattern** (lines 267-275):
```javascript
    notFound(response);
  } catch (error) {
    console.error(error);
    if (pathname.startsWith("/api/")) {
      sendApiJson(response, 500, { error: error?.message || String(error) });
      return;
    }
    sendJson(response, 500, { error: error?.message || String(error) });
  }
}
```

**Planner notes:** Add a `/api/public/:shareToken/:venueId` parser beside `shareFromPath` or generalize path parsing. Validate the share token before calling store functions. For this new public endpoint, preserve generic invalid-token `404`, but use display-safe `500` bodies instead of returning raw error messages.

---

### `server/src/publicAvailability.js` (service/utility, transform + request-response DTO)

**Analogs:** `server/src/sharePage.js`, `server/src/formatAvailability.js`, `server/src/availabilityStore.js`

**Formatter import pattern** (`sharePage.js` line 1):
```javascript
const { formatDateTime } = require("./formatAvailability");
```

**Store read pattern** (`availabilityStore.js` lines 47-62):
```javascript
async function getAvailabilityRecord(venueId) {
  if (USE_SUPABASE) return getAvailabilityRecordFromSupabase(venueId);

  try {
    const raw = await fs.readFile(venuePath(venueId), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function getAvailabilityPayload(venueId) {
  const record = await getAvailabilityRecord(venueId);
  return record?.payload || null;
}
```

**Day/interval transform pattern** (`sharePage.js` lines 12-22, 53-68):
```javascript
function intervalLabel(interval) {
  return `${interval.start_time || "?"}-${interval.end_time || "?"}`;
}

function renderIntervalChips(day) {
  const intervals = Array.isArray(day?.open_intervals) ? day.open_intervals : [];
  if (!intervals.length) return '<p class="empty">No open intervals</p>';

  return `<div class="chips">${intervals
    .map((interval) => `<span class="chip">${escapeHtml(intervalLabel(interval))}</span>`)
    .join("")}</div>`;
}

function renderDay(day, payload) {
  const hours = Number(day?.remaining_hours || 0);
  const hourLabel = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
  const title = day?.date || "Unknown date";
  const subtitle = day?.title || "Court booking";
```

**Freshness pattern** (`sharePage.js` lines 71-75, 214-217; `formatAvailability.js` lines 1-9):
```javascript
const lastUpdated = formatDateTime(payload?.exported_at);
const hasPayload = Boolean(payload && Array.isArray(payload.days));

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  });
}
```

**Planner notes:** New DTO builder should be an allowlist: `state`, `venueId`, `venueName`, `themeId`, `lastReadAt`, `freshnessLabel`, `isStale`, `staleThresholdHours`, `summary`, `days`, `fallbackUrl`. Do not return `record`, raw `payload`, Supabase fields, sync tokens, extension storage keys, or raw slot JSON.

---

### `server/src/bookingLinks.js` (utility, transform)

**Analog:** `server/src/sharePage.js`

**Safe URL pattern** (lines 25-39):
```javascript
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
```

**Date marker pattern** (lines 41-50):
```javascript
function renderBookingActions(day, payload) {
  const bookingUrl = bookingUrlForDay(day, payload);
  if (!bookingUrl) return "";

  const bookingDate = day?.booking_date || day?.date || "";
  const dayUrl = bookingDate ? `${bookingUrl}#pbb_date=${encodeURIComponent(bookingDate)}` : bookingUrl;

  return `<div class="booking-actions">
    <a class="action" href="${escapeHtml(dayUrl)}" target="_blank" rel="noopener">Open booking</a>
  </div>`;
}
```

**Planner notes:** Factor `stripHash` and a non-HTML helper such as `bookingUrlForDay(day, payload)` or `bookingActionForDay(day, payload)` so both `sharePage.js` and `publicAvailability.js` use the same safe booking link behavior.

---

### `server/src/sharePage.js` (component/renderer, transform)

**Analog:** `server/src/sharePage.js`

**Escaping pattern** (lines 3-10):
```javascript
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
```

**Fallback/empty rendering pattern** (lines 71-80):
```javascript
function renderSharePage(payload, { venueId = "venue" } = {}) {
  const venueName = payload?.venue_name || venueId;
  const days = Array.isArray(payload?.days) ? payload.days : [];
  const lastUpdated = formatDateTime(payload?.exported_at);
  const hasPayload = Boolean(payload && Array.isArray(payload.days));

  const dayMarkup = hasPayload
    ? days.map((day) => renderDay(day, payload)).join("") ||
      '<section class="day"><p class="empty">No days were found.</p></section>'
    : '<section class="day"><p class="empty">No cached availability yet.</p></section>';
```

**Export pattern** (lines 227-229):
```javascript
module.exports = {
  renderSharePage,
};
```

**Planner notes:** If helpers are factored out, keep `renderSharePage` behavior stable for `/s/:shareToken/:venueId`. This file is the fallback baseline, not the polished UI target.

---

### `server/src/formatAvailability.js` (utility, transform)

**Analog:** `server/src/formatAvailability.js`

**Interval and day formatting pattern** (lines 12-26):
```javascript
function formatInterval(interval) {
  return `${interval.start_time}-${interval.end_time}`;
}

function formatDay(day) {
  const intervals = day.open_intervals || [];
  const label = day.date || "Unknown date";
  if (!intervals.length) return `${label}: no open intervals`;

  const times = intervals.map(formatInterval).join(", ");
  const hours = Number(day.remaining_hours || 0);
  const hoursLabel = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
  const suffix = hours > 0 ? ` (${hoursLabel}h)` : "";
  return `${label}: ${times}${suffix}`;
}
```

**Export pattern** (lines 68-74):
```javascript
module.exports = {
  answerForMessage,
  formatAvailability,
  formatDateTime,
  formatDay,
  formatInterval,
};
```

**Planner notes:** Reuse `formatDateTime` for the public DTO freshness label. If the DTO needs object-shaped intervals, add a new helper without breaking the existing text formatter.

---

### `server/package.json` (config, batch/check script)

**Analog:** `server/package.json`

**CommonJS/no dependency pattern** (lines 1-12):
```json
{
  "name": "pickleball-availability-bot",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "start": "node src/index.js",
    "check": "node --check src/index.js && node --check src/availabilityStore.js && node --check src/formatAvailability.js && node --check src/messenger.js && node --check src/sharePage.js"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Planner notes:** If new backend files are added, extend the `check` script to include them. Do not add backend runtime dependencies for the public endpoint.

---

### `web/package.json` (config, batch/scripts)

**Analog:** `server/package.json` for script minimalism; no existing web app.

**Pattern to preserve:** Keep the app private and script-driven. Unlike `server/package.json`, this file will introduce Next/React/TypeScript dependencies because `web/` is a new app boundary, not backend runtime code.

**Planner notes:** Use isolated `web/` scripts such as `dev`, `build`, `lint`, and possibly `typecheck`. Do not modify backend package scripts to run frontend checks unless the phase plan explicitly adds root orchestration.

---

### `web/app/s/[shareToken]/[venueId]/page.tsx` (route/component, request-response)

**Analogs:** `server/src/index.js`, `server/src/sharePage.js`

**Dynamic route semantics source** (`index.js` lines 125-140):
```javascript
function shareFromPath(pathname, suffix = "") {
  const pattern = new RegExp(`^/s/([^/]+)/([^/]+)${suffix}$`);
  const match = pathname.match(pattern);
  if (!match) return null;
  const shareToken = decodePathSegment(match[1]);
  const venueId = decodePathSegment(match[2]);
  if (!shareToken || !venueId) return null;
  return { shareToken, venueId };
}
```

**Display semantics source** (`sharePage.js` lines 71-80, 214-220):
```javascript
const venueName = payload?.venue_name || venueId;
const days = Array.isArray(payload?.days) ? payload.days : [];
const lastUpdated = formatDateTime(payload?.exported_at);

<h1>${escapeHtml(venueName)}</h1>
<p class="muted">${lastUpdated ? `Last updated ${escapeHtml(lastUpdated)}` : "Cached availability"}</p>
```

**Planner notes:** The page should not parse raw cache. It should call `web/src/lib/publicAvailability.ts`, then render `AvailabilityPage`. Invalid/empty/error states should map to `not-found.tsx` or an explicit display-safe state. Keep the route shape `/s/[shareToken]/[venueId]` familiar while the backend fallback remains `/s/:shareToken/:venueId`.

---

### `web/src/lib/publicAvailability.ts` (service, request-response fetch + DTO mapping)

**Analogs:** `server/src/index.js`, `server/src/availabilityStore.js`

**Request-response status pattern** (`index.js` lines 154-163):
```javascript
async function handleAvailabilityGet(request, response, venueId) {
  if (!requireSyncToken(request, response)) return;

  const record = await getAvailabilityRecord(venueId);
  if (!record) {
    sendApiJson(response, 404, { error: `No cached availability for ${venueId}` });
    return;
  }
  sendApiJson(response, 200, record);
}
```

**Store abstraction pattern** (`availabilityStore.js` lines 59-62):
```javascript
async function getAvailabilityPayload(venueId) {
  const record = await getAvailabilityRecord(venueId);
  return record?.payload || null;
}
```

**Planner notes:** This frontend helper should fetch only the public display endpoint. Its DTO types should mirror the backend allowlist. Do not include Supabase env names, sync token headers, `chrome.*`, Playbypoint selectors, or extension storage keys.

---

### `web/src/lib/themes.ts` (utility/config, transform)

**Analog:** `extension/venues.js` as safe metadata reference only.

**Venue metadata pattern** (lines 6-15):
```javascript
const venues = [
  {
    id: "propickle",
    name: "ProPickle",
    providerId: PLAYBYPOINT_PROVIDER_ID,
    startUrl: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true",
    setupUrl: "https://book.propickle.com.au/f/ProPickle/booking_waiver",
    readinessTimeoutMs: 10000,
    matchUrls: ["https://book.propickle.com.au/*"],
  },
];
```

**Copy/safety pattern** (lines 18-27, 32-43):
```javascript
const copyVenue = (venue) => ({ ...venue, matchUrls: [...venue.matchUrls] });
const getVenues = () => venues.map(copyVenue);
const getVenue = (venueId) => venues.find((venue) => venue.id === venueId) || venues[0];

globalThis.AvailabilityRegistry = Object.freeze({
  DEFAULT_VENUE_ID,
  getVenues,
  getVenue: (venueId) => copyVenue(getVenue(venueId)),
});
```

**Planner notes:** Do not import this extension file into `web/`. Use it only as a reference for safe public facts: `id`, `name`, and booking domain. Do not copy provider IDs, setup URLs, `skip_waivers`, readiness timeouts, match URLs, or extension storage keys into the public theme file unless a later plan has a clear need and safety review.

---

### `web/src/components/AvailabilityPage.tsx` (component, transform/rendering)

**Analog:** `server/src/sharePage.js`

**Page composition source** (lines 213-220):
```html
<main>
  <header>
    <h1>${escapeHtml(venueName)}</h1>
    <p class="muted">${lastUpdated ? `Last updated ${escapeHtml(lastUpdated)}` : "Cached availability"}</p>
  </header>
  ${dayMarkup}
  <footer>
    This read-only page shows the latest availability last scraped by the browser extension.
  </footer>
</main>
```

**Card/layout CSS source** (lines 136-180, 201-209):
```css
.day {
  background: #fff;
  border: 1px solid #dce5e9;
  border-radius: 8px;
  margin: 0 0 12px;
  padding: 14px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 560px) {
  .day-head { display: block; }
  .booking-actions { justify-content: flex-start; }
}
```

**Planner notes:** Translate the fallback semantics into React components, but apply the UI-SPEC visual contract: black hero band, white availability section, max 8px card radius, system font, explicit empty/stale/error copy, and no nested decorative cards.

---

### `web/src/components/DayCard.tsx` (component, transform/rendering)

**Analog:** `server/src/sharePage.js`

**Day card content order** (lines 53-68):
```javascript
function renderDay(day, payload) {
  const hours = Number(day?.remaining_hours || 0);
  const hourLabel = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
  const title = day?.date || "Unknown date";
  const subtitle = day?.title || "Court booking";

  return `<section class="day">
    <div class="day-head">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p class="meta">${escapeHtml(subtitle)} - ${escapeHtml(hourLabel)} open hour(s)</p>
      </div>
      ${renderBookingActions(day, payload)}
    </div>
    ${renderIntervalChips(day)}
  </section>`;
}
```

**Booking action source** (lines 48-50):
```html
<a class="action" href="${escapeHtml(dayUrl)}" target="_blank" rel="noopener">Open booking</a>
```

**Planner notes:** Keep semantic `section` and `h2`, render backend-provided `bookingUrl` as a real link, and do not construct booking URLs in the component except for display-safe fallback handling.

---

### `web/app/globals.css`, `web/app/layout.tsx`, loading/error files, `HeroScene.tsx`

**Analog:** No existing React/Next app. Use `server/src/sharePage.js` as behavior baseline only.

**Existing CSS constraints to preserve** (`sharePage.js` lines 95-109, 164-189):
```css
* { box-sizing: border-box; }

main {
  margin: 0 auto;
  max-width: 720px;
  min-height: 100vh;
  padding: 20px 16px 28px;
}

.action {
  border-radius: 6px;
  text-decoration: none;
  white-space: nowrap;
}

.chip {
  border-radius: 999px;
  padding: 7px 10px;
}
```

**Planner notes:** Introduce these files cleanly from the UI-SPEC because there is no local web analog. Use plain CSS or CSS modules first. If `HeroScene.tsx` is included, make it client-only, decorative, reduced-motion aware, and non-essential; no existing codebase motion pattern exists.

## Shared Patterns

### Authentication / Access Guard
**Source:** `server/src/index.js` lines 138-140, 172-180  
**Apply to:** `server/src/index.js`, `server/src/publicAvailability.js`
```javascript
function validShareToken(shareToken) {
  return Boolean(SHARE_TOKEN && shareToken && shareToken === SHARE_TOKEN);
}

async function handleSharePage(response, shareToken, venueId) {
  if (!validShareToken(shareToken)) {
    notFound(response);
    return;
  }
```

Public display endpoint must validate token first and return a generic `404` on token failure.

### API Response Formatting
**Source:** `server/src/index.js` lines 45-50, 66-69  
**Apply to:** public API route and CORS preflight
```javascript
function sendApiJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json",
    ...API_CORS_HEADERS,
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function sendApiPreflight(response) {
  response.writeHead(204, API_CORS_HEADERS);
  response.end();
}
```

### Store Boundary
**Source:** `server/src/availabilityStore.js` lines 47-62  
**Apply to:** `server/src/publicAvailability.js`, public route handler
```javascript
async function getAvailabilityRecord(venueId) {
  if (USE_SUPABASE) return getAvailabilityRecordFromSupabase(venueId);
  // local JSON read omitted here for brevity
}

async function getAvailabilityPayload(venueId) {
  const record = await getAvailabilityRecord(venueId);
  return record?.payload || null;
}
```

Public route reads through store only. Frontend never reads Supabase or local cache files.

### Display Escaping / Safe Link Philosophy
**Source:** `server/src/sharePage.js` lines 3-10, 25-39  
**Apply to:** share fallback, booking helper, frontend render assumptions
```javascript
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
```

React will escape text automatically, but backend-generated HTML and URL allowlisting still matter. Booking links must remain plain external links.

### Venue Metadata Safety
**Source:** `extension/venues.js` lines 6-15  
**Apply to:** `server/src/publicAvailability.js`, `web/src/lib/themes.ts`
```javascript
{
  id: "propickle",
  name: "ProPickle",
  providerId: PLAYBYPOINT_PROVIDER_ID,
  startUrl: "https://book.propickle.com.au/book/ProPickle?skip_waivers=true",
  setupUrl: "https://book.propickle.com.au/f/ProPickle/booking_waiver",
  readinessTimeoutMs: 10000,
  matchUrls: ["https://book.propickle.com.au/*"],
}
```

Use this as a reference, not a dependency. Public metadata should be narrower than extension metadata.

### Backend Error Handling
**Source:** `server/src/index.js` lines 267-275  
**Apply to:** public API route
```javascript
} catch (error) {
  console.error(error);
  if (pathname.startsWith("/api/")) {
    sendApiJson(response, 500, { error: error?.message || String(error) });
    return;
  }
  sendJson(response, 500, { error: error?.message || String(error) });
}
```

For the new public endpoint, keep console logging but override body content to a safe generic message so Supabase/request details are not exposed.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `web/next.config.ts` | config | request-response frontend config | No existing web app or TypeScript config exists. |
| `web/tsconfig.json` | config | build/typecheck | No existing TypeScript app exists. |
| `web/app/layout.tsx` | provider/layout | request-response SSR | No existing React/Next layout exists. |
| `web/app/s/[shareToken]/[venueId]/loading.tsx` | component | request-response loading state | No existing client/server loading route pattern exists. |
| `web/app/s/[shareToken]/[venueId]/not-found.tsx` | component | request-response error state | Existing backend has JSON/HTML not-found, not Next not-found components. |
| `web/src/components/HeroScene.tsx` | component | event-driven/client motion | No existing motion, canvas, Three.js, or React component pattern exists. |

## Metadata

**Analog search scope:** `server/src`, `server/package.json`, `extension/venues.js`, repo file inventory excluding `node_modules`  
**Files scanned:** 19 repo/planning-relevant files  
**Pattern extraction date:** 2026-07-02