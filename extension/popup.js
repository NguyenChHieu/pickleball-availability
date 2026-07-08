const venueSelect = document.querySelector("#venueSelect");
const refreshVenueButton = document.querySelector("#refreshVenueButton");
const refreshStaleButton = document.querySelector("#refreshStaleButton");
const refreshAllButton = document.querySelector("#refreshAllButton");
const deepScanVenueButton = document.querySelector("#deepScanVenueButton");
const readCurrentPageButton = document.querySelector("#readCurrentPageButton");
const viewAvailabilityButton = document.querySelector("#viewAvailabilityButton");
const copyShareLinkButton = document.querySelector("#copyShareLinkButton");
const venueStatusListElement = document.querySelector("#venueStatusList");
const savedSummaryElement = document.querySelector("#savedSummary");
const loaderElement = document.querySelector("#loader");
const statusElement = document.querySelector("#status");
const actionsElement = document.querySelector("#actions");
const refreshHistoryElement = document.querySelector("#refreshHistory");
const refreshHistoryListElement = document.querySelector("#refreshHistoryList");
const refreshHistoryCountElement = document.querySelector("#refreshHistoryCount");

const MESSAGE = Object.freeze({
  LIST_VENUES: "AVAILABILITY_LIST_VENUES",
  GET_VENUE_PAYLOAD: "AVAILABILITY_GET_VENUE_PAYLOAD",
  SET_SELECTED_VENUE: "AVAILABILITY_SET_SELECTED_VENUE",
  START_REFRESH_JOB: "AVAILABILITY_START_REFRESH_JOB",
  GET_REFRESH_JOB: "AVAILABILITY_GET_REFRESH_JOB",
  GET_REFRESH_HISTORY: "AVAILABILITY_GET_REFRESH_HISTORY",
  READ_ACTIVE_TAB: "AVAILABILITY_READ_ACTIVE_TAB",
});

const SYNC_CONFIG_KEY = "backendSyncConfig";
const DEFAULT_BACKEND_URL = "http://localhost:3007";
const DEFAULT_SHARE_URL_BASE = "http://localhost:3007";
const DEFAULT_SHARE_TOKEN = "dev-share";
const DEFAULT_STALE_TTL_MS = 5 * 60 * 1000;

let venues = [];
let selectedVenueId = "";
let latestPayload = null;
let latestSyncStatus = null;
let isBusy = false;
let refreshJobPollTimer = null;

function setStatus(message) {
  statusElement.textContent = message;
}

function syncActions() {
  actionsElement.hidden = !latestPayload || !latestSyncStatus?.ok;
}

function syncDeepScanButton() {
  const isDeepScanVenue = Boolean(selectedVenue()?.deepReadProviders);
  deepScanVenueButton.hidden = !isDeepScanVenue;
}

function syncLoader(value) {
  loaderElement.hidden = !value;
}

function setBusy(value) {
  const nextBusy = Boolean(value);
  if (isBusy === nextBusy) return;

  isBusy = nextBusy;
  refreshVenueButton.disabled = nextBusy;
  refreshStaleButton.disabled = nextBusy;
  refreshAllButton.disabled = nextBusy;
  deepScanVenueButton.disabled = nextBusy;
  readCurrentPageButton.disabled = nextBusy;
  venueSelect.disabled = nextBusy;
  syncLoader(nextBusy);
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

function formatIsoAge(isoString) {
  if (!isoString) return "";
  return formatAge({ exported_at: isoString });
}

function formatDuration(ms) {
  const duration = Number(ms || 0);
  if (!duration || duration < 0) return "";
  if (duration < 1000) return "<1s";

  const seconds = Math.round(duration / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function formatElapsed(startIso, finishIso) {
  const startedAt = new Date(startIso || "").getTime();
  const finishedAt = new Date(finishIso || "").getTime();
  if (Number.isNaN(startedAt) || Number.isNaN(finishedAt)) return "";
  return formatDuration(finishedAt - startedAt);
}

function formatLiveElapsed(startIso) {
  return formatElapsed(startIso, new Date().toISOString());
}

function payloadAgeMs(payload) {
  const exportedAt = new Date(payload?.exported_at || "").getTime();
  return Number.isNaN(exportedAt) ? Infinity : Date.now() - exportedAt;
}

function venueStaleTtlMs(venue) {
  return Number(venue?.cacheFirstTtlMs || 0) || DEFAULT_STALE_TTL_MS;
}

function isVenueStale(payload, venue) {
  return !payload || payloadAgeMs(payload) > venueStaleTtlMs(venue);
}

function selectedVenue() {
  return venues.find((venue) => venue.id === selectedVenueId) || venues[0] || null;
}

function venueDisplayName(venue) {
  return venue?.displayName || venue?.name || "Venue";
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function sourceLabel(payload) {
  return payload?.venue_name || venueDisplayName(selectedVenue()) || "this page";
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
    : "Use Refresh Selected or Read Current Page to update the share page.";
  const timeText = age || exportedAt ? ` Last read ${age || exportedAt}.` : "";
  return `Showing saved ${sourceLabel(payload)} result.${timeText} ${shareHint}`;
}

function scanLabel(payload, venue) {
  if (!payload?.days?.length) return "";
  if (!venue?.deepReadProviders) return "";

  const statuses = payload.days
    .map((day) => day.continuity_status)
    .filter(Boolean);
  if (!statuses.length || statuses.includes("not_scanned")) return "quick";
  if (statuses.includes("partial")) return "partial deep";
  if (statuses.includes("available")) return "deep";
  return "";
}

function savedVenueMeta(payload, venue) {
  if (!payload) return "No saved result";

  const parts = [];
  const age = formatAge(payload);
  const dayCount = Array.isArray(payload.days) ? payload.days.length : 0;
  const scan = scanLabel(payload, venue);
  if (age) parts.push(age);
  if (dayCount) parts.push(`${dayCount} day${dayCount === 1 ? "" : "s"}`);
  if (scan) parts.push(scan);
  return parts.join(" / ") || "Saved";
}

function venueBadge(payload, syncStatus, venue) {
  if (!payload) return { text: "empty", className: "" };
  if (isVenueStale(payload, venue)) return { text: "stale", className: "is-stale" };
  if (syncStatus?.ok) return { text: "synced", className: "is-synced" };
  return { text: "saved", className: "" };
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
    option.textContent = venueDisplayName(venue);
    venueSelect.append(option);
  }
  venueSelect.value = selectedVenueId;
  syncDeepScanButton();
}

async function loadVenueSummary(venue) {
  try {
    const response = await sendMessage({
      type: MESSAGE.GET_VENUE_PAYLOAD,
      venueId: venue.id,
    });
    const syncStatus = await storedSyncStatus(venue.id);
    return {
      venue,
      payload: response?.ok ? response.payload : null,
      syncStatus,
    };
  } catch {
    return { venue, payload: null, syncStatus: null };
  }
}

async function refreshVenueStatusList() {
  if (!venues.length) {
    venueStatusListElement.replaceChildren();
    savedSummaryElement.textContent = "No venues";
    return;
  }

  const summaries = await Promise.all(venues.map((venue) => loadVenueSummary(venue)));
  const savedCount = summaries.filter((summary) => summary.payload).length;
  const staleCount = summaries.filter((summary) => isVenueStale(summary.payload, summary.venue)).length;
  savedSummaryElement.textContent = `${savedCount}/${summaries.length} saved`;
  refreshStaleButton.disabled = isBusy || staleCount === 0;
  refreshStaleButton.title =
    staleCount === 0
      ? "All saved results are fresh."
      : `Refresh ${staleCount} venue${staleCount === 1 ? "" : "s"} with missing or stale saved results.`;
  venueStatusListElement.replaceChildren(
    ...summaries.map(({ venue, payload, syncStatus }) => {
      const badge = venueBadge(payload, syncStatus, venue);
      const item = document.createElement("li");
      item.className = `venue-status${venue.id === selectedVenueId ? " is-selected" : ""}`;

      const body = document.createElement("div");
      const name = document.createElement("div");
      name.className = "venue-status-name";
      name.textContent = venueDisplayName(venue);
      const meta = document.createElement("div");
      meta.className = "venue-status-meta";
      meta.textContent = savedVenueMeta(payload, venue);
      body.append(name, meta);

      const badgeElement = document.createElement("span");
      badgeElement.className = `venue-status-badge ${badge.className}`.trim();
      badgeElement.textContent = badge.text;

      item.append(body, badgeElement);
      return item;
    })
  );
}

async function loadSavedPayload() {
  const response = await sendMessage({
    type: MESSAGE.GET_VENUE_PAYLOAD,
    venueId: selectedVenueId,
  });
  if (!response?.ok) throw new Error(response?.error || "Could not load saved availability.");

  if (!response.payload) {
    renderEmpty(
      `No saved ${venueDisplayName(selectedVenue()) || "venue"} result yet. Use Refresh Selected, or open a schedule tab and use Read Current Page.`
    );
    await refreshVenueStatusList();
    return false;
  }

  const syncStatus = await storedSyncStatus(selectedVenueId);
  rememberPayload(response.payload, syncStatus?.ok ? syncStatus : null);
  setStatus(savedPayloadStatus(response.payload, syncStatus));
  await refreshVenueStatusList();
  return true;
}

function isActiveJob(job) {
  return job?.status === "queued" || job?.status === "running";
}

function stopRefreshJobPolling() {
  if (refreshJobPollTimer) clearInterval(refreshJobPollTimer);
  refreshJobPollTimer = null;
}

function startRefreshJobPolling() {
  if (refreshJobPollTimer) return;
  refreshJobPollTimer = setInterval(() => {
    loadRefreshJobStatus().catch((error) => setStatus(error?.message || String(error)));
  }, 1200);
}

function jobStatusMessage(job) {
  if (!job) return "";
  const total = Number(job.total || job.venueIds?.length || 0);
  const completed = Number(job.completed || 0);
  const current = job.currentVenueName ? ` ${job.currentVenueName}` : "";
  const prefix = job.scanMode === "deep" ? "Deep scan" : job.label || "Refresh";

  if (isActiveJob(job)) {
    const elapsed = formatLiveElapsed(job.startedAt);
    const results = Array.isArray(job.results) ? job.results : [];
    const lastFinished = results[results.length - 1];
    const lastTiming = lastFinished ? resultTimingLabel(lastFinished) : "";
    return `${prefix} running: ${completed}/${total}${current ? ` - ${current}` : ""}${
      elapsed ? ` (${elapsed})` : ""
    }. Last saved results stay available.${lastTiming ? `\nLast finished: ${lastTiming}` : ""}`;
  }

  const results = Array.isArray(job.results) ? job.results : [];
  const failed = results.filter((result) => result.status === "failed").length;
  const setupRequired = results.filter((result) => result.status === "setup_required").length;
  const succeeded = results.filter((result) => result.status === "success").length;
  const cacheHits = results.filter((result) => result.status === "success" && result.cacheHit).length;
  const timings = results
    .map((result) => {
      const duration = formatDuration(result.durationMs);
      return duration ? `${result.venueName || result.venueId}: ${duration}` : "";
    })
    .filter(Boolean)
    .join(", ");
  if (job.status === "failed") return `${prefix} failed. ${job.error || "Start it again when you are ready."}`;
  if (failed || setupRequired) {
    const details = results
      .filter((result) => result.status === "failed" || result.status === "setup_required")
      .map((result) => {
        const reason = result.message || result.syncMessage || "No details available.";
        const duration = formatDuration(result.durationMs);
        return `${result.venueName || result.venueId}: ${reason}${duration ? ` (${duration})` : ""}`;
      })
      .join("\n");
    return `${prefix} finished with issues: ${succeeded} succeeded, ${failed} failed, ${setupRequired} need setup.${
      details ? `\n${details}` : ""
    }${timings ? `\nTimings: ${timings}` : ""}`;
  }
  return `${prefix} complete: ${succeeded || completed} venue(s) refreshed.${
    cacheHits ? ` ${cacheHits} recent cache reused.` : ""
  }${timings ? `\nTimings: ${timings}` : ""}`;
}

function jobCounts(job) {
  const results = Array.isArray(job?.results) ? job.results : [];
  return {
    failed: results.filter((result) => result.status === "failed").length,
    setupRequired: results.filter((result) => result.status === "setup_required").length,
    succeeded: results.filter((result) => result.status === "success").length,
    cacheHits: results.filter((result) => result.status === "success" && result.cacheHit).length,
  };
}

function resultTimingLabel(result) {
  const duration = formatDuration(result?.durationMs);
  return duration ? `${result.venueName || result.venueId}: ${duration}` : "";
}

function resultTimingSummary(results, limit = 3) {
  const timings = (Array.isArray(results) ? results : [])
    .map((result) => resultTimingLabel(result))
    .filter(Boolean);
  if (!timings.length) return "";
  const shown = timings.slice(0, limit).join(" / ");
  const hidden = timings.length - limit;
  return hidden > 0 ? `${shown} / +${hidden} more` : shown;
}

function slowestResultSummary(job) {
  const results = Array.isArray(job?.results) ? job.results : [];
  const slowest = results.reduce((current, result) => {
    const currentMs = Number(current?.durationMs || 0);
    const nextMs = Number(result?.durationMs || 0);
    return nextMs > currentMs ? result : current;
  }, null);
  const label = resultTimingLabel(slowest);
  return label ? `slowest ${label}` : "";
}

function historyBadge(job) {
  if (job.status === "completed") return { text: "ok", className: "is-ok" };
  if (job.status === "completed_with_issues") return { text: "issues", className: "is-warning" };
  return { text: "failed", className: "is-error" };
}

function historyTitle(job) {
  if (job.label) return job.label;
  return job.scanMode === "deep" ? "Deep scan" : "Refresh";
}

function historyMeta(job) {
  const counts = jobCounts(job);
  const total = Number(job.total || 0);
  const pieces = [];
  if (counts.succeeded) pieces.push(`${counts.succeeded}/${total || counts.succeeded} ok`);
  if (counts.failed) pieces.push(`${counts.failed} failed`);
  if (counts.setupRequired) pieces.push(`${counts.setupRequired} setup`);
  if (counts.cacheHits) pieces.push(`${counts.cacheHits} cached`);
  const elapsed = formatElapsed(job.startedAt, job.finishedAt);
  const slowest = slowestResultSummary(job);
  const age = formatIsoAge(job.finishedAt);
  if (elapsed) pieces.push(elapsed);
  if (slowest) pieces.push(slowest);
  if (age) pieces.push(age);
  return pieces.join(" / ") || "No details";
}

function historyDetails(job) {
  const timings = resultTimingSummary(job?.results, 4);
  if (timings) return `Timings: ${timings}`;
  if (job?.error) return job.error;
  return "";
}

function renderRefreshHistory(history) {
  const items = Array.isArray(history) ? history.slice(0, 5) : [];
  refreshHistoryElement.hidden = !items.length;
  refreshHistoryCountElement.textContent = items.length ? `${items.length}` : "";
  refreshHistoryListElement.replaceChildren(
    ...items.map((job) => {
      const badge = historyBadge(job);
      const item = document.createElement("li");
      const body = document.createElement("div");
      const title = document.createElement("div");
      title.className = "refresh-history-title";
      title.textContent = historyTitle(job);
      const meta = document.createElement("div");
      meta.className = "refresh-history-meta";
      meta.textContent = historyMeta(job);
      const details = document.createElement("div");
      details.className = "refresh-history-details";
      details.textContent = historyDetails(job);
      details.hidden = !details.textContent;
      body.append(title, meta, details);

      const badgeElement = document.createElement("span");
      badgeElement.className = `refresh-history-badge ${badge.className}`;
      badgeElement.textContent = badge.text;

      item.title = job.error || "";
      item.append(body, badgeElement);
      return item;
    })
  );
}

async function loadRefreshHistory() {
  const response = await sendMessage({ type: MESSAGE.GET_REFRESH_HISTORY });
  if (!response?.ok) throw new Error(response?.error || "Could not load refresh history.");
  renderRefreshHistory(response.history || []);
}

async function loadRefreshJobStatus({ silentWhenInactive = false } = {}) {
  const response = await sendMessage({ type: MESSAGE.GET_REFRESH_JOB });
  if (!response?.ok) throw new Error(response?.error || "Could not load refresh status.");

  const job = response.job || null;
  const active = isActiveJob(job);
  setBusy(active);
  if (!job) return null;
  if (silentWhenInactive && (job.status === "completed" || job.status === "completed_with_issues")) return job;

  setStatus(jobStatusMessage(job));
  if (active) {
    startRefreshJobPolling();
    return job;
  }

  stopRefreshJobPolling();
  await loadRefreshHistory();
  if (job.venueIds?.includes(selectedVenueId)) {
    try {
      await loadSavedPayload();
    } catch {
      // The job status is still more useful than failing to refresh the popup snapshot.
    }
    setStatus(jobStatusMessage(job));
  }
  return job;
}

async function startRefreshJob({ venueIds, scanMode = "fast", label = "Refresh" }) {
  if (isBusy || !selectedVenueId) return;

  const isDeepScan = scanMode === "deep";
  if (isDeepScan && !confirmDeepScan()) return;

  setBusy(true);
  setStatus(`${isDeepScan ? "Starting deep scan" : `Starting ${label.toLowerCase()}`}...`);

  try {
    const response = await sendMessage({
      type: MESSAGE.START_REFRESH_JOB,
      venueIds,
      scanMode,
      label,
    });
    if (!response?.ok) throw new Error(response?.error || "Refresh job failed to start.");

    setStatus(response.alreadyRunning ? "A refresh is already running." : jobStatusMessage(response.job));
    await loadRefreshHistory();
    startRefreshJobPolling();
  } catch (error) {
    setStatus(savedFallbackStatus(isDeepScan ? "Deep scan" : label, error));
    setBusy(false);
    stopRefreshJobPolling();
  }
}

async function refreshStaleVenues() {
  const summaries = await Promise.all(venues.map((venue) => loadVenueSummary(venue)));
  const staleVenueIds = summaries
    .filter((summary) => isVenueStale(summary.payload, summary.venue))
    .map((summary) => summary.venue.id);

  if (!staleVenueIds.length) {
    setStatus("All saved results are fresh.");
    await refreshVenueStatusList();
    return;
  }

  await startRefreshJob({
    venueIds: staleVenueIds,
    scanMode: "cache-first",
    label: "Refresh stale",
  });
}

async function refreshVenue() {
  await startRefreshJob({
    venueIds: [selectedVenueId],
    scanMode: "fast",
    label: "Refresh selected",
  });
}

async function refreshAllVenues() {
  if (!confirmRefreshAll()) return;
  await startRefreshJob({
    venueIds: venues.map((venue) => venue.id),
    scanMode: "cache-first",
    label: "Refresh all",
  });
}

async function deepScanVenue() {
  await startRefreshJob({
    venueIds: [selectedVenueId],
    scanMode: "deep",
    label: "Deep scan",
  });
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
    await refreshVenueStatusList();
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

function confirmRefreshAll() {
  return window.confirm(
    "Refresh all may open multiple booking tabs and slow venues can take a while. Recent cached results may be reused, and last saved results stay visible. Continue?"
  );
}

async function init() {
  const response = await sendMessage({ type: MESSAGE.LIST_VENUES });
  if (!response?.ok) throw new Error(response?.error || "Could not load venues.");

  venues = response.venues || [];
  selectedVenueId = response.selectedVenueId || AvailabilityRegistry.DEFAULT_VENUE_ID;
  populateVenues();
  await refreshVenueStatusList();
  await loadSavedPayload();
  await loadRefreshHistory();
  await loadRefreshJobStatus({ silentWhenInactive: true });
}

venueSelect.addEventListener("change", () => {
  selectVenue(venueSelect.value).catch((error) => setStatus(error?.message || String(error)));
});
refreshVenueButton.addEventListener("click", () => refreshVenue());
refreshStaleButton.addEventListener("click", () => refreshStaleVenues());
refreshAllButton.addEventListener("click", () => refreshAllVenues());
deepScanVenueButton.addEventListener("click", () => deepScanVenue());
readCurrentPageButton.addEventListener("click", readCurrentPage);
viewAvailabilityButton.addEventListener("click", viewAvailability);
copyShareLinkButton.addEventListener("click", copyShareLink);

init().catch((error) => {
  setBusy(false);
  renderEmpty(error?.message || String(error));
});
