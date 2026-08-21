// Tab reading: injects provider scripts, reads a venue's booking widget, and
// saves/caches the resulting payload. No shared mutable state - pure reads
// plus a sync-client call, one of the two leaf modules (with sync.js) that
// readerWindow.js, pendingRefresh.js, and refreshJob.js all depend on.

import { AvailabilityRegistry } from "./venues.js";
import { normalizeStoredBackendUrl, storedBackendSyncConfig, syncStatusKey, syncVenuePayload } from "./sync.js";

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PROVIDER_FILES = Object.freeze({
  "playbypoint-bookbox": "providers/playbypointBookBox.js",
  "clubspark-book-by-date": "providers/clubsparkBookByDate.js",
  "mindbody-appointments": "providers/mindbodyAppointments.js",
  "playtomic-availability": "providers/playtomicAvailability.js",
  "podplay-dom": "providers/podplayDom.js",
  "hamlet-experience": "providers/hamletExperience.js",
});

export async function waitForTabComplete(tabId, timeoutMs = 45000) {
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

export async function readTab(tabId, venue) {
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

export function venueForScanMode(venue, scanMode = "fast") {
  const readVenue = {
    ...venue,
    matchUrls: [...(venue.matchUrls || [])],
    services: venue.services?.map((service) => ({ ...service })),
  };

  if (scanMode === "cache-first" && Number(readVenue.cacheFirstReadDays || 0) > 0) {
    readVenue.readDays = Number(readVenue.cacheFirstReadDays);
  }

  if (readVenue.deepReadProviders) {
    readVenue.readProviders = scanMode === "deep";
  }

  return readVenue;
}

export async function saveVenuePayload(venueId, payload, refreshAttempt = null) {
  await chrome.storage.local.set({ [AvailabilityRegistry.venuePayloadKey(venueId)]: payload });
  return syncVenuePayload(venueId, payload, refreshAttempt);
}

async function storedVenuePayload(venueId) {
  const key = AvailabilityRegistry.venuePayloadKey(venueId);
  const stored = await chrome.storage.local.get(key);
  return stored[key] || null;
}

function payloadAgeMs(payload) {
  const exportedAt = new Date(payload?.exported_at || "").getTime();
  return Number.isNaN(exportedAt) ? Infinity : Date.now() - exportedAt;
}

export async function cacheFirstPayload(venue, scanMode) {
  if (scanMode !== "cache-first" || !Number(venue.cacheFirstTtlMs || 0)) return null;

  const payload = await storedVenuePayload(venue.id);
  if (!payload) return null;

  const config = await storedBackendSyncConfig();
  if (config.enabled && config.backendUrl) {
    const key = syncStatusKey(venue.id);
    const stored = await chrome.storage.local.get(key);
    const syncStatus = stored[key];
    if (!syncStatus?.ok || normalizeStoredBackendUrl(syncStatus.backend_url) !== config.backendUrl) {
      return null;
    }
  }

  return payloadAgeMs(payload) <= Number(venue.cacheFirstTtlMs) ? payload : null;
}

