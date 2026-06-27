const venueSelect = document.querySelector("#venueSelect");
const refreshVenueButton = document.querySelector("#refreshVenueButton");
const readCurrentPageButton = document.querySelector("#readCurrentPageButton");
const copyShareLinkButton = document.querySelector("#copyShareLinkButton");
const copyButton = document.querySelector("#copyButton");
const downloadButton = document.querySelector("#downloadButton");
const statusElement = document.querySelector("#status");
const actionsElement = document.querySelector("#actions");
const resultsElement = document.querySelector("#results");

const MESSAGE = Object.freeze({
  LIST_VENUES: "AVAILABILITY_LIST_VENUES",
  GET_VENUE_PAYLOAD: "AVAILABILITY_GET_VENUE_PAYLOAD",
  SET_SELECTED_VENUE: "AVAILABILITY_SET_SELECTED_VENUE",
  REFRESH_VENUE: "AVAILABILITY_REFRESH_VENUE",
  READ_ACTIVE_TAB: "AVAILABILITY_READ_ACTIVE_TAB",
});

const SYNC_CONFIG_KEY = "backendSyncConfig";
const DEFAULT_BACKEND_URL = "http://localhost:8787";
const DEFAULT_SHARE_TOKEN = "dev-share";

let venues = [];
let selectedVenueId = "";
let latestPayload = null;
let isBusy = false;

function setStatus(message) {
  statusElement.textContent = message;
}

function syncActions() {
  actionsElement.hidden = isBusy || !latestPayload;
}

function setBusy(value) {
  isBusy = value;
  refreshVenueButton.disabled = value;
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

function selectedVenue() {
  return venues.find((venue) => venue.id === selectedVenueId) || venues[0] || null;
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function sourceLabel(payload) {
  return payload?.venue_name || selectedVenue()?.name || "this page";
}

function renderEmpty(message) {
  latestPayload = null;
  syncActions();
  resultsElement.replaceChildren();
  setStatus(message);
}

function render(payload) {
  latestPayload = payload;
  syncActions();
  resultsElement.replaceChildren();

  for (const day of payload.days || []) {
    const section = document.createElement("section");
    section.className = "day";

    const title = document.createElement("h2");
    title.textContent = day.date || "Unknown date";
    section.append(title);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${day.title || "Court booking"} - ${day.remaining_hours || 0} open hour(s)`;
    section.append(meta);

    const intervals = document.createElement("div");
    intervals.className = "intervals";
    const openIntervals = day.open_intervals || [];
    if (!openIntervals.length) {
      const empty = document.createElement("span");
      empty.className = "empty";
      empty.textContent = "No open intervals";
      intervals.append(empty);
    } else {
      for (const interval of openIntervals) {
        const chip = document.createElement("span");
        chip.className = "interval";
        chip.textContent = `${interval.start_time}-${interval.end_time}`;
        intervals.append(chip);
      }
    }
    section.append(intervals);
    resultsElement.append(section);
  }
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
}

async function loadSavedPayload() {
  const response = await sendMessage({
    type: MESSAGE.GET_VENUE_PAYLOAD,
    venueId: selectedVenueId,
  });
  if (!response?.ok) throw new Error(response?.error || "Could not load saved availability.");

  if (!response.payload) {
    renderEmpty(`No saved ${selectedVenue()?.name || "venue"} result yet.`);
    return false;
  }

  render(response.payload);
  const exportedAt = formatExportTime(response.payload);
  setStatus(
    exportedAt
      ? `Showing saved ${sourceLabel(response.payload)} result from ${exportedAt}.`
      : `Showing saved ${sourceLabel(response.payload)} result.`
  );
  return true;
}

async function refreshVenue({ auto = false } = {}) {
  if (isBusy || !selectedVenueId) return;

  setBusy(true);
  setStatus(auto ? `Refreshing ${selectedVenue()?.name || "venue"}...` : "Refreshing venue...");

  try {
    const response = await sendMessage({
      type: MESSAGE.REFRESH_VENUE,
      venueId: selectedVenueId,
    });
    if (!response?.ok) throw new Error(response?.error || "Refresh failed.");

    if (response.manualSetupRequired) {
      syncActions();
      setStatus(`${response.error} Finish setup in the opened tab, then use Read Current Page.`);
      return;
    }

    render(response.payload);
    setStatus(`Read ${(response.payload.days || []).length} day(s) for ${response.venue.name}.`);
  } catch (error) {
    const prefix = latestPayload ? "Refresh failed; showing saved result: " : "";
    setStatus(prefix + (error?.message || String(error)));
  } finally {
    setBusy(false);
  }
}

async function readCurrentPage() {
  if (isBusy) return;

  setBusy(true);
  setStatus(latestPayload ? "Reading current page..." : "Reading current page...");

  try {
    const response = await sendMessage({ type: MESSAGE.READ_ACTIVE_TAB });
    if (!response?.ok) throw new Error(response?.error || "Current page read failed.");
    if (response.venue?.id) {
      selectedVenueId = response.venue.id;
      venueSelect.value = selectedVenueId;
      await sendMessage({ type: MESSAGE.SET_SELECTED_VENUE, venueId: selectedVenueId });
    }
    render(response.payload);
    setStatus(`Read ${(response.payload.days || []).length} day(s) from the current page.`);
  } catch (error) {
    const prefix = latestPayload ? "Current page read failed; showing saved result: " : "";
    setStatus(prefix + (error?.message || String(error)));
  } finally {
    setBusy(false);
  }
}

async function copyJson() {
  if (!latestPayload) return;
  await navigator.clipboard.writeText(JSON.stringify(latestPayload, null, 2));
  setStatus("Copied JSON to clipboard.");
}

function normalizeShareUrlBase(value) {
  const normalized = (value || DEFAULT_BACKEND_URL).trim().replace(/\/+$/, "");
  new URL(normalized);
  return normalized;
}

async function copyShareLink() {
  if (!latestPayload) return;

  try {
    const stored = await chrome.storage.local.get(SYNC_CONFIG_KEY);
    const config = stored[SYNC_CONFIG_KEY] || {};
    const venueId = latestPayload.venue_id || selectedVenueId;
    if (!venueId) throw new Error("Select a venue before copying a share link.");

    const base = normalizeShareUrlBase(config.shareUrlBase || config.backendUrl);
    const shareToken = (config.shareToken || DEFAULT_SHARE_TOKEN).trim();
    const link = `${base}/s/${encodeURIComponent(shareToken)}/${encodeURIComponent(venueId)}`;
    await navigator.clipboard.writeText(link);
    setStatus("Copied share link.");
  } catch (error) {
    setStatus(error?.message || String(error));
  }
}

function downloadJson() {
  if (!latestPayload) return;
  const venue = latestPayload.venue_id || selectedVenueId || "availability";
  const blob = new Blob([JSON.stringify(latestPayload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${venue}_availability.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus(`Downloaded ${link.download}.`);
}

async function selectVenue(venueId) {
  const response = await sendMessage({
    type: MESSAGE.SET_SELECTED_VENUE,
    venueId,
  });
  if (!response?.ok) throw new Error(response?.error || "Could not select venue.");
  selectedVenueId = response.venue.id;
  venueSelect.value = selectedVenueId;
  const hasSavedPayload = await loadSavedPayload();
  if (!hasSavedPayload) await refreshVenue({ auto: true });
}

async function init() {
  const response = await sendMessage({ type: MESSAGE.LIST_VENUES });
  if (!response?.ok) throw new Error(response?.error || "Could not load venues.");

  venues = response.venues || [];
  selectedVenueId = response.selectedVenueId || AvailabilityRegistry.DEFAULT_VENUE_ID;
  populateVenues();
  const hasSavedPayload = await loadSavedPayload();
  if (!hasSavedPayload) await refreshVenue({ auto: true });
}

venueSelect.addEventListener("change", () => {
  selectVenue(venueSelect.value).catch((error) => setStatus(error?.message || String(error)));
});
refreshVenueButton.addEventListener("click", () => refreshVenue());
readCurrentPageButton.addEventListener("click", readCurrentPage);
copyShareLinkButton.addEventListener("click", copyShareLink);
copyButton.addEventListener("click", copyJson);
downloadButton.addEventListener("click", downloadJson);

init().catch((error) => {
  setBusy(false);
  renderEmpty(error?.message || String(error));
});
