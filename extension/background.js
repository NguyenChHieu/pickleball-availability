import { AvailabilityRegistry } from "./venues.js";
import { beginRefreshAttempt, reportRefreshStatus, refreshStatusForSync } from "./sync.js";
import { readTab, saveVenuePayload } from "./tabReader.js";
import { forgetReaderTab, forgetReaderWindow } from "./readerWindow.js";
import { clearPendingRefresh, continuePendingRefresh, tabIdFromPendingRefreshAlarm } from "./pendingRefresh.js";
import {
  currentRefreshJob,
  openPendingSetupWindow,
  pendingSetupVenueIds,
  startRefreshJob,
  storedRefreshHistory,
} from "./refreshJob.js";

const MESSAGE = Object.freeze({
  LIST_VENUES: "AVAILABILITY_LIST_VENUES",
  GET_VENUE_PAYLOAD: "AVAILABILITY_GET_VENUE_PAYLOAD",
  SET_SELECTED_VENUE: "AVAILABILITY_SET_SELECTED_VENUE",
  START_REFRESH_JOB: "AVAILABILITY_START_REFRESH_JOB",
  GET_REFRESH_JOB: "AVAILABILITY_GET_REFRESH_JOB",
  GET_REFRESH_HISTORY: "AVAILABILITY_GET_REFRESH_HISTORY",
  OPEN_SETUP_WINDOW: "AVAILABILITY_OPEN_SETUP_WINDOW",
  READ_ACTIVE_TAB: "AVAILABILITY_READ_ACTIVE_TAB",
  READ_CURRENT_PAGE: "AVAILABILITY_READ_CURRENT_PAGE",
});

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
  const startedAt = Date.now();
  const tab = await activeTab();
  const venue = AvailabilityRegistry.findVenueForUrl(tab.url) || fallbackVenueForTab(tab);
  let refreshAttempt = null;
  try {
    refreshAttempt = venue.id ? await beginRefreshAttempt(venue.id) : null;
    const payload = await readTab(tab.id, venue);
    const syncStatus = venue.id
      ? await saveVenuePayload(venue.id, payload, refreshAttempt)
      : { ok: false, skipped: true, reason: "Current page is not mapped to a saved venue." };
    if (venue.id) {
      await reportRefreshStatus(
        venue.id,
        {
          status: refreshStatusForSync(syncStatus),
          duration_ms: Math.min(30 * 60 * 1000, Date.now() - startedAt),
          source: "current_page",
        },
        refreshAttempt
      );
    }
    return { venue, payload, syncStatus };
  } catch (error) {
    if (venue.id) {
      await reportRefreshStatus(
        venue.id,
        {
          status: error.manualSetupRequired ? "setup_required" : "failed",
          duration_ms: Math.min(30 * 60 * 1000, Date.now() - startedAt),
          source: "current_page",
        },
        refreshAttempt
      );
    }
    throw error;
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;
  continuePendingRefresh(tabId, "tab-complete").catch((error) => console.warn(error));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  const tabId = tabIdFromPendingRefreshAlarm(alarm.name);
  if (tabId === null) return;
  continuePendingRefresh(tabId, "alarm").catch((error) => console.warn(error));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  forgetReaderTab(tabId);
  clearPendingRefresh(tabId).catch((error) => console.warn(error));
});

chrome.windows.onRemoved.addListener((windowId) => {
  forgetReaderWindow(windowId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === MESSAGE.LIST_VENUES) return listVenues();
    if (message?.type === MESSAGE.GET_VENUE_PAYLOAD) return getVenuePayload(message.venueId);
    if (message?.type === MESSAGE.SET_SELECTED_VENUE) return setSelectedVenue(message.venueId);
    if (message?.type === MESSAGE.START_REFRESH_JOB) return startRefreshJob(message);
    if (message?.type === MESSAGE.GET_REFRESH_JOB) {
      return { job: await currentRefreshJob(), pendingSetupVenueIds: await pendingSetupVenueIds() };
    }
    if (message?.type === MESSAGE.GET_REFRESH_HISTORY) return { history: await storedRefreshHistory() };
    if (message?.type === MESSAGE.OPEN_SETUP_WINDOW) return openPendingSetupWindow(message.venueId);
    if (message?.type === MESSAGE.READ_ACTIVE_TAB) return readActiveTab();
    throw new Error("Unknown availability message.");
  })()
    .then((payload) => sendResponse({ ok: true, ...payload }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));

  return true;
});
