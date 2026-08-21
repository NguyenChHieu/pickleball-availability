// Pending-refresh retry state machine: when a venue read needs manual setup
// (login/waiver/etc.), the session is persisted here and retried either when
// the tab finishes navigating or when the chrome.alarms fallback fires.
// Owns pendingRefreshAttempts (in-memory re-entry guard) as module-private
// state, plus the durable chrome.storage.local pending-refresh records.
//
// Circular import with readerWindow.js: see the comment there. This module
// needs focusTab/closeTab; readerWindow.js's releaseRefreshReaderWindow needs
// loadPendingRefreshes back.
//
// normalizeRefreshSource/REFRESH_SOURCES live here rather than in
// refreshJob.js (their more obvious semantic home) because this module
// already needs them and refreshJob.js already imports several other things
// from this module - adding one more name to an edge that already exists,
// instead of creating a new one back the other way.

import { AvailabilityRegistry } from "./venues.js";
import { reportRefreshStatus, refreshStatusForSync } from "./sync.js";
import { readTab, saveVenuePayload, venueForScanMode, wait } from "./tabReader.js";
import { closeTab, focusTab } from "./readerWindow.js";

const PENDING_REFRESH_KEY = "pendingVenueRefreshes";
const PENDING_REFRESH_TTL_MS = 5 * 60 * 1000;
const PENDING_REFRESH_RETRY_MS = 8000;
const REFRESH_SOURCES = new Set(["selected", "stale", "all", "deep", "current_page"]);

const pendingRefreshAttempts = new Set();

export function normalizeRefreshSource(source, scanMode = "fast", label = "") {
  if (REFRESH_SOURCES.has(source)) return source;
  if (scanMode === "deep") return "deep";
  const normalizedLabel = String(label || "").toLowerCase();
  if (normalizedLabel.includes("stale")) return "stale";
  if (normalizedLabel.includes("all")) return "all";
  return "selected";
}

const pendingTabKey = (tabId) => String(tabId);

export async function loadPendingRefreshes() {
  const stored = await chrome.storage.local.get(PENDING_REFRESH_KEY);
  return stored[PENDING_REFRESH_KEY] || {};
}

async function savePendingRefreshes(pendingRefreshes) {
  await chrome.storage.local.set({ [PENDING_REFRESH_KEY]: pendingRefreshes });
}

async function pendingRefreshForTab(tabId) {
  const pendingRefreshes = await loadPendingRefreshes();
  return pendingRefreshes[pendingTabKey(tabId)] || null;
}

const PENDING_REFRESH_ALARM_PREFIX = "pbb-pending-refresh-";

function pendingRefreshAlarmName(tabId) {
  return `${PENDING_REFRESH_ALARM_PREFIX}${Number(tabId)}`;
}

export function tabIdFromPendingRefreshAlarm(alarmName) {
  if (!alarmName.startsWith(PENDING_REFRESH_ALARM_PREFIX)) return null;
  const tabId = Number(alarmName.slice(PENDING_REFRESH_ALARM_PREFIX.length));
  return Number.isFinite(tabId) ? tabId : null;
}

async function clearPendingRefreshTimer(tabId) {
  await chrome.alarms.clear(pendingRefreshAlarmName(tabId));
}

// ponytail: chrome.alarms (not setTimeout) because MV3 service workers can be
// suspended mid-wait and an in-memory setTimeout dies with them silently -
// alarms are tracked by Chrome independent of the worker and always fire.
// Trade-off: alarms clamp sub-minute delays to ~30s even for unpacked/dev
// extensions, so a retry that used to fire in 8s now fires in up to ~30s.
async function schedulePendingRefresh(tabId, delayMs = PENDING_REFRESH_RETRY_MS) {
  await clearPendingRefreshTimer(tabId);
  chrome.alarms.create(pendingRefreshAlarmName(tabId), { delayInMinutes: delayMs / 60000 });
}

export async function clearPendingRefresh(tabId) {
  const pendingRefreshes = await loadPendingRefreshes();
  delete pendingRefreshes[pendingTabKey(tabId)];
  await savePendingRefreshes(pendingRefreshes);
  await clearPendingRefreshTimer(tabId);
}

export async function savePendingRefresh(session) {
  const pendingRefreshes = await loadPendingRefreshes();
  pendingRefreshes[pendingTabKey(session.tabId)] = session;
  await savePendingRefreshes(pendingRefreshes);
  await schedulePendingRefresh(session.tabId);
}

export function pendingRefreshSession(tabId, venue, closeWhenDone, error, refreshAttempt = null) {
  const now = Date.now();
  return {
    tabId: Number(tabId),
    venueId: venue.id,
    scanMode: venue.scanMode || "fast",
    source: normalizeRefreshSource(venue.refreshSource, venue.scanMode),
    closeWhenDone: Boolean(closeWhenDone),
    startedAt: now,
    expiresAt: now + (venue.pendingRefreshTimeoutMs || PENDING_REFRESH_TTL_MS),
    lastAttemptAt: now,
    lastError: error?.message || String(error || ""),
    refreshAttempt,
  };
}

function sameOrigin(leftUrl, rightUrl) {
  try {
    return new URL(leftUrl).origin === new URL(rightUrl).origin;
  } catch {
    return false;
  }
}

function sameUrlWithoutHash(leftUrl, rightUrl) {
  try {
    const left = new URL(leftUrl);
    const right = new URL(rightUrl);
    return (
      left.origin === right.origin &&
      left.pathname.toLowerCase() === right.pathname.toLowerCase() &&
      left.search === right.search
    );
  } catch {
    return false;
  }
}

function isSetupUrl(url, venue) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return (
      Boolean(venue.setupUrl && sameUrlWithoutHash(url, venue.setupUrl)) ||
      pathname.includes("auth") ||
      pathname.includes("login") ||
      pathname.includes("sign") ||
      pathname.includes("waiver") ||
      pathname.includes("password")
    );
  } catch {
    return false;
  }
}

function shouldReturnToVenueStart(tab, venue, session, error) {
  if (!tab?.url || !venue.startUrl || !sameOrigin(tab.url, venue.startUrl)) return false;
  if (sameUrlWithoutHash(tab.url, venue.startUrl)) return false;
  if (isSetupUrl(tab.url, venue)) return false;
  if (session.returnedToStartAt) return false;

  const message = (error?.message || "").toLowerCase();
  const pathname = new URL(tab.url).pathname.toLowerCase();
  const looksLikePostLoginPage =
    pathname.includes("profile") ||
    pathname.includes("account") ||
    pathname.includes("dashboard") ||
    pathname.includes("user") ||
    message.includes("schedule widget is not visible");

  return looksLikePostLoginPage;
}

async function returnPendingRefreshToVenueStart(tabId, venue, session, error) {
  const pendingRefreshes = await loadPendingRefreshes();
  const existing = pendingRefreshes[pendingTabKey(tabId)] || session;
  pendingRefreshes[pendingTabKey(tabId)] = {
    ...existing,
    lastAttemptAt: Date.now(),
    lastError: error?.message || String(error || ""),
    returnedToStartAt: Date.now(),
  };
  await savePendingRefreshes(pendingRefreshes);
  await clearPendingRefreshTimer(tabId);
  await chrome.tabs.update(Number(tabId), { url: venue.startUrl });
}

async function touchPendingRefresh(tabId, error) {
  const pendingRefreshes = await loadPendingRefreshes();
  const existing = pendingRefreshes[pendingTabKey(tabId)];
  if (!existing) return;

  pendingRefreshes[pendingTabKey(tabId)] = {
    ...existing,
    lastAttemptAt: Date.now(),
    lastError: error?.message || String(error || ""),
  };
  await savePendingRefreshes(pendingRefreshes);
  await schedulePendingRefresh(tabId);
}

export async function continuePendingRefresh(tabId, _reason) {
  const key = pendingTabKey(tabId);
  if (pendingRefreshAttempts.has(key)) return;

  const session = await pendingRefreshForTab(tabId);
  if (!session) return;

  if (Date.now() > session.expiresAt) {
    await reportRefreshStatus(
      session.venueId,
      {
        status: "failed",
        duration_ms: Math.min(30 * 60 * 1000, Math.max(0, Date.now() - Number(session.startedAt || Date.now()))),
        source: normalizeRefreshSource(session.source, session.scanMode),
      },
      session.refreshAttempt
    );
    await clearPendingRefresh(tabId);
    return;
  }

  pendingRefreshAttempts.add(key);
  try {
    const venue = AvailabilityRegistry.getVenue(session.venueId);
    const readVenue = venueForScanMode(venue, session.scanMode);
    const tab = await chrome.tabs.get(Number(tabId)).catch(() => null);
    if (shouldReturnToVenueStart(tab, readVenue, session, null)) {
      await returnPendingRefreshToVenueStart(tabId, readVenue, session, null);
      return null;
    }

    if (session.scanMode === "deep") await focusTab(Number(tabId));
    await wait(300);
    const payload = await readTab(Number(tabId), readVenue);
    const syncStatus = await saveVenuePayload(venue.id, payload, session.refreshAttempt);
    await reportRefreshStatus(
      venue.id,
      {
        status: refreshStatusForSync(syncStatus),
        duration_ms: Math.min(30 * 60 * 1000, Math.max(0, Date.now() - Number(session.startedAt || Date.now()))),
        source: normalizeRefreshSource(session.source, session.scanMode),
      },
      session.refreshAttempt
    );
    await clearPendingRefresh(tabId);
    if (session.closeWhenDone) await closeTab(Number(tabId));
    return { venue, payload, syncStatus };
  } catch (error) {
    if (error.manualSetupRequired) {
      const venue = AvailabilityRegistry.getVenue(session.venueId);
      const readVenue = venueForScanMode(venue, session.scanMode);
      const tab = await chrome.tabs.get(Number(tabId)).catch(() => null);
      if (shouldReturnToVenueStart(tab, readVenue, session, error)) {
        await returnPendingRefreshToVenueStart(tabId, readVenue, session, error);
        return null;
      }

      await touchPendingRefresh(tabId, error);
      return null;
    }

    await clearPendingRefresh(tabId);
    await reportRefreshStatus(
      session.venueId,
      {
        status: "failed",
        duration_ms: Math.min(30 * 60 * 1000, Math.max(0, Date.now() - Number(session.startedAt || Date.now()))),
        source: normalizeRefreshSource(session.source, session.scanMode),
      },
      session.refreshAttempt
    );
    console.warn(error);
    return null;
  } finally {
    pendingRefreshAttempts.delete(key);
  }
}

