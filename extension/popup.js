const venueSelect = document.querySelector("#venueSelect");
const refreshVenueButton = document.querySelector("#refreshVenueButton");
const deepScanVenueButton = document.querySelector("#deepScanVenueButton");
const readCurrentPageButton = document.querySelector("#readCurrentPageButton");
const viewAvailabilityButton = document.querySelector("#viewAvailabilityButton");
const copyShareLinkButton = document.querySelector("#copyShareLinkButton");
const statusElement = document.querySelector("#status");
const actionsElement = document.querySelector("#actions");
const deepScanWarningElement = document.querySelector("#deepScanWarning");

const MESSAGE = Object.freeze({
  LIST_VENUES: "AVAILABILITY_LIST_VENUES",
  GET_VENUE_PAYLOAD: "AVAILABILITY_GET_VENUE_PAYLOAD",
  SET_SELECTED_VENUE: "AVAILABILITY_SET_SELECTED_VENUE",
  REFRESH_VENUE: "AVAILABILITY_REFRESH_VENUE",
  READ_ACTIVE_TAB: "AVAILABILITY_READ_ACTIVE_TAB",
});

const SYNC_CONFIG_KEY = "backendSyncConfig";
const DEFAULT_BACKEND_URL = "http://localhost:3007";
const DEFAULT_SHARE_URL_BASE = "http://localhost:3007";
const DEFAULT_SHARE_TOKEN = "dev-share";

let venues = [];
let selectedVenueId = "";
let latestPayload = null;
let latestSyncStatus = null;
let isBusy = false;

function setStatus(message) {
  statusElement.textContent = message;
}

function syncActions() {
  actionsElement.hidden = !latestPayload || !latestSyncStatus?.ok;
}

function syncDeepScanButton() {
  const isDeepScanVenue = Boolean(selectedVenue()?.deepReadProviders);
  deepScanVenueButton.hidden = !isDeepScanVenue;
  deepScanWarningElement.hidden = !isDeepScanVenue;
}

function setBusy(value) {
  isBusy = value;
  refreshVenueButton.disabled = value;
  deepScanVenueButton.disabled = value;
  readCurrentPageButton.disabled = value;
  venueSelect.disabled = value;
  syncActions();
}

function formatExportTime(payload) {
  if (!payload?.exported_at) return "";
  const date = new Date(payload.exported_at);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function formatAge(payload) {
  if (!payload?.exported_at) return "";
  const exportedAt = new Date(payload.exported_at).getTime();
  if (Number.isNaN(exportedAt)) return "";

  const seconds = Math.max(0, Math.round((Date.now() - exportedAt) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function selectedVenue() {
  return venues.find((venue) => venue.id === selectedVenueId) || venues[0] || null;
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function sourceLabel(payload) {
  return payload?.venue_name || selectedVenue()?.name || "this page";
}

function syncStatusMessage(syncStatus) {
  if (!syncStatus) return "";
  if (syncStatus.ok) return "Synced to web app.";
  return syncStatus.error || syncStatus.reason || "Web app sync did not complete.";
}

function readStatus(payload, syncStatus, prefix) {
  const dayCount = (payload?.days || []).length;
  const syncMessage = syncStatusMessage(syncStatus);
  const age = formatAge(payload);
  return `${prefix} ${dayCount} day(s).${age ? ` Last read ${age}.` : ""}${
    syncMessage ? ` ${syncMessage}` : ""
  }`;
}

function savedPayloadStatus(payload, syncStatus) {
  const exportedAt = formatExportTime(payload);
  const age = formatAge(payload);
  const shareHint = syncStatus?.ok
    ? "View Availability and Copy Share Link are ready."
    : "Use Refresh Venue or Read Current Page to update the share page.";
  const timeText = age || exportedAt ? ` Last read ${age || exportedAt}.` : "";
  return `Showing saved ${sourceLabel(payload)} result.${timeText} ${shareHint}`;
}

function savedFallbackStatus(action, error) {
  const saved = latestPayload ? savedPayloadStatus(latestPayload, latestSyncStatus) : "";
  const detail = error?.message || String(error);
  return saved ? `${action} failed. ${saved} ${detail}` : `${action} failed. ${detail}`;
}

function renderEmpty(message) {
  latestPayload = null;
  latestSyncStatus = null;
  syncActions();
  setStatus(message);
}

function rememberPayload(payload, syncStatus = null) {
  latestPayload = payload;
  latestSyncStatus = syncStatus;
  syncActions();
}

function syncStatusKey(venueId) {
  return `backendSyncStatus:${venueId}`;
}

async function storedSyncStatus(venueId) {
  if (!venueId) return null;
  const stored = await chrome.storage.local.get(syncStatusKey(venueId));
  return stored[syncStatusKey(venueId)] || null;
}

function populateVenues() {
  venueSelect.replaceChildren();
  for (const venue of venues) {
    const option = document.createElement("option");
    option.value = venue.id;
    option.textContent = venue.name;
    venueSelect.append(option);
  }
  venueSelect.value = selectedVenueId;
  syncDeepScanButton();
}

async function loadSavedPayload() {
  const response = await sendMessage({
    type: MESSAGE.GET_VENUE_PAYLOAD,
    venueId: selectedVenueId,
  });
  if (!response?.ok) throw new Error(response?.error || "Could not load saved availability.");

  if (!response.payload) {
    renderEmpty(
      `No saved ${selectedVenue()?.name || "venue"} result yet. Use Refresh Venue, or open a schedule tab and use Read Current Page.`
    );
    return false;
  }

  const syncStatus = await storedSyncStatus(selectedVenueId);
  rememberPayload(response.payload, syncStatus?.ok ? syncStatus : null);
  setStatus(savedPayloadStatus(response.payload, syncStatus));
  return true;
}

async function refreshVenue(scanMode = "fast") {
  if (isBusy || !selectedVenueId) return;

  const isDeepScan = scanMode === "deep";
  if (isDeepScan && !confirmDeepScan()) return;

  setBusy(true);
  setStatus(`${isDeepScan ? "Deep scanning courts for" : "Refreshing"} ${selectedVenue()?.name || "venue"}...`);

  try {
    const response = await sendMessage({
      type: MESSAGE.REFRESH_VENUE,
      venueId: selectedVenueId,
      scanMode,
    });
    if (!response?.ok) throw new Error(response?.error || "Refresh failed.");

    if (response.manualSetupRequired) {
      syncActions();
      const followUp = response.pendingRefresh
        ? "Finish setup in the opened tab. I will continue automatically when the schedule appears."
        : "Finish setup in the opened tab, then try again.";
      setStatus(`${response.error} ${followUp}`);
      return;
    }

    rememberPayload(response.payload, response.syncStatus);
    setStatus(
      readStatus(response.payload, response.syncStatus, `${isDeepScan ? "Deep scan" : "Read"} for ${response.venue.name}:`)
    );
  } catch (error) {
    setStatus(savedFallbackStatus(isDeepScan ? "Deep scan" : "Refresh", error));
  } finally {
    setBusy(false);
  }
}

async function readCurrentPage() {
  if (isBusy) return;

  setBusy(true);
  setStatus("Reading current page...");

  try {
    const response = await sendMessage({ type: MESSAGE.READ_ACTIVE_TAB });
    if (!response?.ok) throw new Error(response?.error || "Current page read failed.");
    if (response.venue?.id) {
      selectedVenueId = response.venue.id;
      venueSelect.value = selectedVenueId;
      await sendMessage({ type: MESSAGE.SET_SELECTED_VENUE, venueId: selectedVenueId });
    }
    rememberPayload(response.payload, response.syncStatus);
    setStatus(readStatus(response.payload, response.syncStatus, "Read from the current page:"));
  } catch (error) {
    setStatus(savedFallbackStatus("Current page read", error));
  } finally {
    setBusy(false);
  }
}

function normalizeShareUrlBase(value) {
  const normalized = (value || DEFAULT_SHARE_URL_BASE).trim().replace(/\/+$/, "");
  new URL(normalized);
  return normalized;
}

async function shareLink() {
  if (!latestPayload) return;

  if (!latestSyncStatus?.ok) {
    throw new Error("Sync to the web app first, then use the share page.");
  }

  const stored = await chrome.storage.local.get(SYNC_CONFIG_KEY);
  const config = stored[SYNC_CONFIG_KEY] || {};
  const venueId = latestPayload.venue_id || selectedVenueId;
  if (!venueId) throw new Error("Select a venue before opening a share link.");

  const base = normalizeShareUrlBase(config.shareUrlBase);
  const shareToken = (config.shareToken || DEFAULT_SHARE_TOKEN).trim();
  return `${base}/s/${encodeURIComponent(shareToken)}/${encodeURIComponent(venueId)}`;
}

async function viewAvailability() {
  try {
    const link = await shareLink();
    if (!link) return;
    await chrome.tabs.create({ url: link });
    setStatus("Opened availability page.");
  } catch (error) {
    setStatus(error?.message || String(error));
  }
}

async function copyShareLink() {
  try {
    const link = await shareLink();
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setStatus("Copied share link.");
  } catch (error) {
    setStatus(error?.message || String(error));
  }
}

async function selectVenue(venueId) {
  const response = await sendMessage({
    type: MESSAGE.SET_SELECTED_VENUE,
    venueId,
  });
  if (!response?.ok) throw new Error(response?.error || "Could not select venue.");
  selectedVenueId = response.venue.id;
  venueSelect.value = selectedVenueId;
  syncDeepScanButton();
  await loadSavedPayload();
}

function confirmDeepScan() {
  return window.confirm(
    "Deep scan checks each court/provider and can take several minutes for North Ryde. It is read-only, but slower than normal refresh. Continue?"
  );
}

async function init() {
  const response = await sendMessage({ type: MESSAGE.LIST_VENUES });
  if (!response?.ok) throw new Error(response?.error || "Could not load venues.");

  venues = response.venues || [];
  selectedVenueId = response.selectedVenueId || AvailabilityRegistry.DEFAULT_VENUE_ID;
  populateVenues();
  await loadSavedPayload();
}

venueSelect.addEventListener("change", () => {
  selectVenue(venueSelect.value).catch((error) => setStatus(error?.message || String(error)));
});
refreshVenueButton.addEventListener("click", () => refreshVenue());
deepScanVenueButton.addEventListener("click", () => refreshVenue("deep"));
readCurrentPageButton.addEventListener("click", readCurrentPage);
viewAvailabilityButton.addEventListener("click", viewAvailability);
copyShareLinkButton.addEventListener("click", copyShareLink);

init().catch((error) => {
  setBusy(false);
  renderEmpty(error?.message || String(error));
});
