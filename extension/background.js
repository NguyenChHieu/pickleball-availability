importScripts("venues.js");

const MESSAGE = Object.freeze({
  LIST_VENUES: "AVAILABILITY_LIST_VENUES",
  GET_VENUE_PAYLOAD: "AVAILABILITY_GET_VENUE_PAYLOAD",
  SET_SELECTED_VENUE: "AVAILABILITY_SET_SELECTED_VENUE",
  REFRESH_VENUE: "AVAILABILITY_REFRESH_VENUE",
  READ_ACTIVE_TAB: "AVAILABILITY_READ_ACTIVE_TAB",
  READ_CURRENT_PAGE: "AVAILABILITY_READ_CURRENT_PAGE",
});

const PROVIDER_FILES = Object.freeze({
  "playbypoint-bookbox": "providers/playbypointBookBox.js",
});

const SYNC_CONFIG_KEY = "backendSyncConfig";
const OLD_LOCAL_BACKEND_URL = "http://localhost:8787";
const DEFAULT_BACKEND_URL = "http://localhost:3007";
const PENDING_REFRESH_KEY = "pendingVenueRefreshes";
const PENDING_REFRESH_TTL_MS = 5 * 60 * 1000;
const PENDING_REFRESH_RETRY_MS = 8000;

const refreshInFlight = new Map();
const pendingRefreshAttempts = new Set();
const pendingRefreshTimers = new Map();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function selectedVenueId() {
  const stored = await chrome.storage.local.get(AvailabilityRegistry.SELECTED_VENUE_KEY);
  return stored[AvailabilityRegistry.SELECTED_VENUE_KEY] || AvailabilityRegistry.DEFAULT_VENUE_ID;
}

async function listVenues() {
  return {
    venues: AvailabilityRegistry.getVenues(),
    selectedVenueId: await selectedVenueId(),
  };
}

async function getVenuePayload(venueId) {
  const venue = AvailabilityRegistry.getVenue(venueId);
  const key = AvailabilityRegistry.venuePayloadKey(venue.id);
  const stored = await chrome.storage.local.get(key);
  return { venue, payload: stored[key] || null };
}

async function setSelectedVenue(venueId) {
  const venue = AvailabilityRegistry.getVenue(venueId);
  await chrome.storage.local.set({ [AvailabilityRegistry.SELECTED_VENUE_KEY]: venue.id });
  return { venue };
}

async function waitForTabComplete(tabId, timeoutMs = 45000) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === "complete") return;

  await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for the booking page to load."));
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function injectReader(tabId, providerId) {
  const providerFile = PROVIDER_FILES[providerId];
  if (!providerFile) throw new Error(`Unsupported provider: ${providerId}`);

  await chrome.scripting.executeScript({ target: { tabId }, files: [providerFile] });
  await chrome.scripting.executeScript({ target: { tabId }, files: ["contentScript.js"] });
}

async function readTab(tabId, venue) {
  await injectReader(tabId, venue.providerId);
  const response = await chrome.tabs.sendMessage(tabId, {
    type: MESSAGE.READ_CURRENT_PAGE,
    providerId: venue.providerId,
    venue,
    readinessTimeoutMs: venue.readinessTimeoutMs || 0,
  });

  if (!response?.ok) {
    const error = new Error(response?.error || "Reader failed.");
    error.manualSetupRequired = Boolean(response?.manualSetupRequired);
    throw error;
  }

  return response.payload;
}

async function saveVenuePayload(venueId, payload) {
  await chrome.storage.local.set({ [AvailabilityRegistry.venuePayloadKey(venueId)]: payload });
  return syncVenuePayload(venueId, payload);
}

function syncStatusKey(venueId) {
  return `backendSyncStatus:${venueId}`;
}

function availabilityEndpoint(backendUrl, venueId) {
  const base = new URL(backendUrl);
  const prefix = base.pathname.replace(/\/+$/, "");
  base.pathname = `${prefix}/api/availability/${encodeURIComponent(venueId)}`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

function normalizeStoredBackendUrl(backendUrl) {
  return backendUrl === OLD_LOCAL_BACKEND_URL ? DEFAULT_BACKEND_URL : backendUrl;
}

async function syncVenuePayload(venueId, payload) {
  const stored = await chrome.storage.local.get(SYNC_CONFIG_KEY);
  const config = stored[SYNC_CONFIG_KEY] || {};
  const backendUrl = normalizeStoredBackendUrl(config.backendUrl);
  if (!config.enabled || !backendUrl) {
    return {
      ok: false,
      skipped: true,
      reason: "Web app sync is off.",
    };
  }

  const endpoint = availabilityEndpoint(backendUrl, venueId);

  try {
    const headers = { "content-type": "application/json" };
    if (config.syncToken) headers["x-sync-token"] = config.syncToken;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Web app sync failed: ${response.status} ${body}`);
    }

    const status = {
      ok: true,
      synced_at: new Date().toISOString(),
    };
    await chrome.storage.local.set({ [syncStatusKey(venueId)]: status });
    return status;
  } catch (error) {
    const status = {
      ok: false,
      failed_at: new Date().toISOString(),
      error: syncErrorMessage(error, endpoint),
    };
    await chrome.storage.local.set({ [syncStatusKey(venueId)]: status });
    return status;
  }
}

function syncErrorMessage(error, endpoint) {
  const message = error?.message || String(error);
  if (message === "Failed to fetch" || error?.name === "TypeError") {
    return `Failed to reach ${endpoint}. Check the App URL, extension permission, and web app health.`;
  }
  return message;
}

async function firstOpenVenueTab(venue) {
  const tabs = await chrome.tabs.query({ url: venue.matchUrls });
  return tabs.find((tab) => tab.id) || null;
}

async function tabForVenue(venue) {
  const existingTab = await firstOpenVenueTab(venue);
  if (existingTab?.id) return { tab: existingTab, closeWhenDone: false };

  const tab = await chrome.tabs.create({ url: venue.startUrl, active: false });
  return { tab, closeWhenDone: true };
}

async function activateTab(tabId) {
  try {
    await chrome.tabs.update(tabId, { active: true });
  } catch {
    // The user may have closed the tab before the fallback could focus it.
  }
}

async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
  } catch {
    // A closed tab after a successful read is fine; the payload is already saved.
  }
}

const pendingTabKey = (tabId) => String(tabId);

async function loadPendingRefreshes() {
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

function clearPendingRefreshTimer(tabId) {
  const timer = pendingRefreshTimers.get(Number(tabId));
  if (timer) clearTimeout(timer);
  pendingRefreshTimers.delete(Number(tabId));
}

function schedulePendingRefresh(tabId, delayMs = PENDING_REFRESH_RETRY_MS) {
  clearPendingRefreshTimer(tabId);
  const timer = setTimeout(() => {
    pendingRefreshTimers.delete(Number(tabId));
    continuePendingRefresh(tabId, "timer").catch((error) => console.warn(error));
  }, delayMs);
  pendingRefreshTimers.set(Number(tabId), timer);
}

async function clearPendingRefresh(tabId) {
  const pendingRefreshes = await loadPendingRefreshes();
  delete pendingRefreshes[pendingTabKey(tabId)];
  await savePendingRefreshes(pendingRefreshes);
  clearPendingRefreshTimer(tabId);
}

async function savePendingRefresh(session) {
  const pendingRefreshes = await loadPendingRefreshes();
  pendingRefreshes[pendingTabKey(session.tabId)] = session;
  await savePendingRefreshes(pendingRefreshes);
  schedulePendingRefresh(session.tabId);
}

function pendingRefreshSession(tabId, venue, closeWhenDone, error) {
  const now = Date.now();
  return {
    tabId: Number(tabId),
    venueId: venue.id,
    closeWhenDone: Boolean(closeWhenDone),
    startedAt: now,
    expiresAt: now + (venue.pendingRefreshTimeoutMs || PENDING_REFRESH_TTL_MS),
    lastAttemptAt: now,
    lastError: error?.message || String(error || ""),
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
  clearPendingRefreshTimer(tabId);
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
  schedulePendingRefresh(tabId);
}

async function continuePendingRefresh(tabId, _reason) {
  const key = pendingTabKey(tabId);
  if (pendingRefreshAttempts.has(key)) return;

  const session = await pendingRefreshForTab(tabId);
  if (!session) return;

  if (Date.now() > session.expiresAt) {
    await clearPendingRefresh(tabId);
    return;
  }

  pendingRefreshAttempts.add(key);
  try {
    const venue = AvailabilityRegistry.getVenue(session.venueId);
    const tab = await chrome.tabs.get(Number(tabId)).catch(() => null);
    if (shouldReturnToVenueStart(tab, venue, session, null)) {
      await returnPendingRefreshToVenueStart(tabId, venue, session, null);
      return null;
    }

    await wait(300);
    const payload = await readTab(Number(tabId), venue);
    const syncStatus = await saveVenuePayload(venue.id, payload);
    await clearPendingRefresh(tabId);
    if (session.closeWhenDone) await closeTab(Number(tabId));
    return { venue, payload, syncStatus };
  } catch (error) {
    if (error.manualSetupRequired) {
      const venue = AvailabilityRegistry.getVenue(session.venueId);
      const tab = await chrome.tabs.get(Number(tabId)).catch(() => null);
      if (shouldReturnToVenueStart(tab, venue, session, error)) {
        await returnPendingRefreshToVenueStart(tabId, venue, session, error);
        return null;
      }

      await touchPendingRefresh(tabId, error);
      return null;
    }

    await clearPendingRefresh(tabId);
    console.warn(error);
    return null;
  } finally {
    pendingRefreshAttempts.delete(key);
  }
}

async function refreshVenueNow(venueId) {
  const venue = AvailabilityRegistry.getVenue(venueId);
  const { tab, closeWhenDone } = await tabForVenue(venue);

  try {
    await waitForTabComplete(tab.id);
    await wait(1200);
    const payload = await readTab(tab.id, venue);
    const syncStatus = await saveVenuePayload(venue.id, payload);
    if (closeWhenDone) await closeTab(tab.id);
    return { venue, payload, syncStatus, manualSetupRequired: false };
  } catch (error) {
    if (!error.manualSetupRequired) {
      if (closeWhenDone && tab.id) await closeTab(tab.id);
      throw error;
    }
    if (!tab.id) {
      return {
        venue,
        payload: null,
        manualSetupRequired: true,
        pendingRefresh: false,
        error: "Manual setup needed, but the booking tab is no longer available.",
      };
    }

    await activateTab(tab.id);
    await savePendingRefresh(pendingRefreshSession(tab.id, venue, closeWhenDone, error));
    return {
      venue,
      payload: null,
      manualSetupRequired: true,
      pendingRefresh: true,
      error: error?.message || String(error),
    };
  }
}

async function refreshVenue(venueId) {
  const venue = AvailabilityRegistry.getVenue(venueId);
  if (refreshInFlight.has(venue.id)) return refreshInFlight.get(venue.id);

  const refreshPromise = refreshVenueNow(venue.id).finally(() => refreshInFlight.delete(venue.id));
  refreshInFlight.set(venue.id, refreshPromise);
  return refreshPromise;
}

const fallbackVenueForTab = (tab) => ({
  id: "",
  name: "Current page",
  providerId: AvailabilityRegistry.PLAYBYPOINT_PROVIDER_ID,
  startUrl: tab.url || "",
  matchUrls: [],
});

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  return tab;
}

async function readActiveTab() {
  const tab = await activeTab();
  const venue = AvailabilityRegistry.findVenueForUrl(tab.url) || fallbackVenueForTab(tab);
  const payload = await readTab(tab.id, venue);
  const syncStatus = venue.id
    ? await saveVenuePayload(venue.id, payload)
    : { ok: false, skipped: true, reason: "Current page is not mapped to a saved venue." };
  return { venue, payload, syncStatus };
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;
  continuePendingRefresh(tabId, "tab-complete").catch((error) => console.warn(error));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearPendingRefresh(tabId).catch((error) => console.warn(error));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === MESSAGE.LIST_VENUES) return listVenues();
    if (message?.type === MESSAGE.GET_VENUE_PAYLOAD) return getVenuePayload(message.venueId);
    if (message?.type === MESSAGE.SET_SELECTED_VENUE) return setSelectedVenue(message.venueId);
    if (message?.type === MESSAGE.REFRESH_VENUE) return refreshVenue(message.venueId);
    if (message?.type === MESSAGE.READ_ACTIVE_TAB) return readActiveTab();
    throw new Error("Unknown availability message.");
  })()
    .then((payload) => sendResponse({ ok: true, ...payload }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));

  return true;
});
