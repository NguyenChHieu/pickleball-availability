const venueSelect = document.querySelector("#venueSelect");
const refreshVenueButton = document.querySelector("#refreshVenueButton");
const refreshStaleButton = document.querySelector("#refreshStaleButton");
const refreshAllButton = document.querySelector("#refreshAllButton");
const deepScanVenueButton = document.querySelector("#deepScanVenueButton");
const readCurrentPageButton = document.querySelector("#readCurrentPageButton");
const viewAvailabilityButton = document.querySelector("#viewAvailabilityButton");
const copyShareLinkButton = document.querySelector("#copyShareLinkButton");
const createPlannerButton = document.querySelector("#createPlannerButton");
const copyProbeSummaryButton = document.querySelector("#copyProbeSummaryButton");
const venueStatusListElement = document.querySelector("#venueStatusList");
const savedSummaryElement = document.querySelector("#savedSummary");
const loaderElement = document.querySelector("#loader");
const statusElement = document.querySelector("#status");
const openSetupWindowButton = document.querySelector("#openSetupWindowButton");
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
  OPEN_SETUP_WINDOW: "AVAILABILITY_OPEN_SETUP_WINDOW",
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
let refreshAllConfirmUntil = 0;
let refreshAllConfirmTimer = null;
let refreshHistory = [];
let refreshSelection = new Set();
let savedSummaryCounts = { saved: 0, total: 0 };

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

function hasProbeDebug(payload = latestPayload) {
  return Boolean(payload?.days?.some((day) => Array.isArray(day.probe_debug) && day.probe_debug.length));
}

function syncProbeSummaryButton() {
  copyProbeSummaryButton.hidden = !hasProbeDebug();
}

function syncLoader(value) {
  loaderElement.hidden = !value;
}

function setBusy(value) {
  const nextBusy = Boolean(value);
  if (isBusy === nextBusy) return;

  isBusy = nextBusy;
  if (nextBusy) resetRefreshAllConfirm();
  if (nextBusy) openSetupWindowButton.hidden = true;
  refreshVenueButton.disabled = nextBusy;
  refreshStaleButton.disabled = nextBusy;
  refreshAllButton.disabled = nextBusy;
  deepScanVenueButton.disabled = nextBusy;
  openSetupWindowButton.disabled = nextBusy;
  copyProbeSummaryButton.disabled = nextBusy;
  readCurrentPageButton.disabled = nextBusy;
  createPlannerButton.disabled = nextBusy;
  venueSelect.disabled = nextBusy;
  syncLoader(nextBusy);
  syncActions();
  syncProbeSummaryButton();
  syncRefreshSelectionUi();
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

function validVenueIds() {
  return venues.map((venue) => venue.id);
}

function normalizeRefreshSelection({ ensureDefault = false } = {}) {
  const validIds = validVenueIds();
  refreshSelection = new Set([...refreshSelection].filter((venueId) => validIds.includes(venueId)));
  if (ensureDefault && !refreshSelection.size && selectedVenueId) refreshSelection.add(selectedVenueId);
}

function selectedRefreshVenueIds() {
  normalizeRefreshSelection();
  return [...refreshSelection];
}

function syncRefreshSelectionUi() {
  const selectedIds = selectedRefreshVenueIds();
  const count = selectedIds.length;
  refreshVenueButton.textContent = count > 1 ? `Refresh ${count} selected` : "Refresh selected";
  refreshVenueButton.title = count
    ? count > 1
      ? `Refresh ${count} checked venues.`
      : "Refresh the checked venue."
    : "Tick at least one venue above.";
  refreshVenueButton.disabled = isBusy || !count;

  for (const checkbox of venueStatusListElement.querySelectorAll(".venue-status-check")) {
    checkbox.checked = refreshSelection.has(checkbox.value);
    checkbox.disabled = isBusy;
  }
}

function setSavedSummary(savedCount = savedSummaryCounts.saved, totalCount = savedSummaryCounts.total) {
  savedSummaryCounts = { saved: savedCount, total: totalCount };
  savedSummaryElement.textContent = `${savedCount}/${totalCount} saved - ${refreshSelection.size} selected`;
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
    ? "View Availability and Copy Availability Link are ready."
    : "Tick venues above and use Refresh Selected, or use Read Current Page to update the availability page.";
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

function savedVenueMeta(payload, venue, lastRefresh = null) {
  const refreshMeta = refreshResultMeta(lastRefresh);
  if (!payload) return refreshMeta ? `No saved result / ${refreshMeta}` : "No saved result";

  const parts = [];
  const age = formatAge(payload);
  const dayCount = Array.isArray(payload.days) ? payload.days.length : 0;
  const scan = scanLabel(payload, venue);
  if (age) parts.push(age);
  if (dayCount) parts.push(`${dayCount} day${dayCount === 1 ? "" : "s"}`);
  if (scan) parts.push(scan);
  if (refreshMeta) parts.push(refreshMeta);
  return parts.join(" / ") || "Saved";
}

function venueBadge(payload, syncStatus, venue, lastRefresh = null) {
  if (lastRefresh?.status === "failed") return { text: "failed", className: "is-error" };
  if (lastRefresh?.status === "setup_required") return { text: "setup", className: "is-warning" };
  if (!payload) return { text: "empty", className: "" };
  if (isVenueStale(payload, venue)) return { text: "stale", className: "is-stale" };
  if (lastRefresh?.status === "success" && lastRefresh.cacheHit) return { text: "cached", className: "is-cached" };
  if (syncStatus?.ok) return { text: "synced", className: "is-synced" };
  return { text: "saved", className: "" };
}

function latestRefreshForVenue(venueId) {
  for (const job of refreshHistory) {
    const result = (Array.isArray(job?.results) ? job.results : []).find((item) => item.venueId === venueId);
    if (result) return result;
  }
  return null;
}

function refreshResultMeta(result) {
  if (!result) return "";
  const duration = formatDuration(result.durationMs);
  const suffix = duration ? ` ${duration}` : "";
  if (result.status === "success" && result.cacheHit) return `cached${suffix}`;
  if (result.status === "success") return `last refresh ok${suffix}`;
  if (result.status === "setup_required") return `setup needed${suffix}`;
  if (result.status === "failed") return `last refresh failed${suffix}`;
  return "";
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
  syncProbeSummaryButton();
  setStatus(message);
}

function rememberPayload(payload, syncStatus = null) {
  latestPayload = payload;
  latestSyncStatus = syncStatus;
  syncActions();
  syncProbeSummaryButton();
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
  normalizeRefreshSelection({ ensureDefault: true });
  setSavedSummary(savedCount, summaries.length);
  refreshStaleButton.disabled = isBusy || staleCount === 0;
  refreshStaleButton.title =
    staleCount === 0
      ? "All saved results are fresh."
      : `Refresh ${staleCount} venue${staleCount === 1 ? "" : "s"} with missing or stale saved results.`;
  venueStatusListElement.replaceChildren(
    ...summaries.map(({ venue, payload, syncStatus }) => {
      const lastRefresh = latestRefreshForVenue(venue.id);
      const badge = venueBadge(payload, syncStatus, venue, lastRefresh);
      const item = document.createElement("li");
      item.className = `venue-status${venue.id === selectedVenueId ? " is-selected" : ""}`;

      const checkbox = document.createElement("input");
      checkbox.className = "venue-status-check";
      checkbox.type = "checkbox";
      checkbox.value = venue.id;
      checkbox.checked = refreshSelection.has(venue.id);
      checkbox.disabled = isBusy;
      checkbox.title = `Include ${venueDisplayName(venue)} in Refresh selected.`;
      checkbox.setAttribute("aria-label", `Include ${venueDisplayName(venue)} in Refresh selected`);

      const body = document.createElement("div");
      body.className = "venue-status-body";
      const name = document.createElement("div");
      name.className = "venue-status-name";
      const nameButton = document.createElement("button");
      nameButton.className = "venue-status-view";
      nameButton.type = "button";
      nameButton.dataset.venueId = venue.id;
      nameButton.textContent = venueDisplayName(venue);
      name.append(nameButton);
      const meta = document.createElement("div");
      meta.className = "venue-status-meta";
      meta.textContent = savedVenueMeta(payload, venue, lastRefresh);
      body.append(name, meta);

      const badgeElement = document.createElement("span");
      badgeElement.className = `venue-status-badge ${badge.className}`.trim();
      badgeElement.textContent = badge.text;

      item.append(checkbox, body, badgeElement);
      return item;
    })
  );
  syncRefreshSelectionUi();
}

async function loadSavedPayload() {
  const response = await sendMessage({
    type: MESSAGE.GET_VENUE_PAYLOAD,
    venueId: selectedVenueId,
  });
  if (!response?.ok) throw new Error(response?.error || "Could not load saved availability.");

  if (!response.payload) {
    renderEmpty(
      `No saved ${venueDisplayName(selectedVenue()) || "venue"} result yet. Tick venues above and use Refresh Selected, or open a schedule tab and use Read Current Page.`
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
  const isDeepScan = job.scanMode === "deep";
  const prefix = isDeepScan ? "Deep scan" : job.label || "Refresh";
  const parallelLimit = Number(job.parallelLimit || 1);
  const parallelNote = parallelLimit > 1 ? ` Up to ${parallelLimit} venues refresh at once.` : "";
  const deepScanNote = isDeepScan ? " Keep the reader window visible." : "";

  if (isActiveJob(job)) {
    const elapsed = formatLiveElapsed(job.startedAt);
    const results = Array.isArray(job.results) ? job.results : [];
    const lastFinished = results[results.length - 1];
    const lastTiming = lastFinished ? resultTimingLabel(lastFinished) : "";
    return `${prefix} running: ${completed}/${total}${current ? ` - ${current}` : ""}${
      elapsed ? ` (${elapsed})` : ""
    }.${parallelNote}${deepScanNote} Last saved results stay available.${
      lastTiming ? `\nLast finished: ${lastTiming}` : ""
    }`;
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
  const parallelLimit = Number(job.parallelLimit || 1);
  const pieces = [];
  if (counts.succeeded) pieces.push(`${counts.succeeded}/${total || counts.succeeded} ok`);
  if (counts.failed) pieces.push(`${counts.failed} failed`);
  if (counts.setupRequired) pieces.push(`${counts.setupRequired} setup`);
  if (counts.cacheHits) pieces.push(`${counts.cacheHits} cached`);
  if (parallelLimit > 1) pieces.push(`${parallelLimit} venues at once`);
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
  refreshHistory = Array.isArray(response.history) ? response.history : [];
  renderRefreshHistory(refreshHistory);
}

async function loadRefreshJobStatus({ silentWhenInactive = false } = {}) {
  const response = await sendMessage({ type: MESSAGE.GET_REFRESH_JOB });
  if (!response?.ok) throw new Error(response?.error || "Could not load refresh status.");

  const job = response.job || null;
  const active = isActiveJob(job);
  setBusy(active);
  syncSetupAction(job, response.pendingSetupVenueIds);
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

function syncSetupAction(job, pendingSetupVenueIds = []) {
  const pendingVenueIds = new Set(Array.isArray(pendingSetupVenueIds) ? pendingSetupVenueIds : []);
  const setupResult = Array.isArray(job?.results)
    ? job.results.find(
        (result) => result.status === "setup_required" && result.pendingRefresh && pendingVenueIds.has(result.venueId)
      )
    : null;
  openSetupWindowButton.hidden = !setupResult || isActiveJob(job);
  openSetupWindowButton.dataset.venueId = setupResult?.venueId || "";
}

async function openSetupWindow() {
  const response = await sendMessage({
    type: MESSAGE.OPEN_SETUP_WINDOW,
    venueId: openSetupWindowButton.dataset.venueId || "",
  });
  if (!response?.ok) throw new Error(response?.error || "Could not open the setup window.");
  openSetupWindowButton.hidden = true;
  setStatus("Opened the setup window. Finish setup there; the read will retry automatically.");
}

async function startRefreshJob({ venueIds, scanMode = "fast", label = "Refresh" }) {
  if (isBusy || !selectedVenueId) return;

  const isDeepScan = scanMode === "deep";
  if (isDeepScan && !confirmDeepScan()) return;

  setBusy(true);
  setStatus(
    isDeepScan
      ? "Starting deep scan... Keep the reader window visible until it finishes."
      : `Starting ${label.toLowerCase()}...`
  );

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
  const venueIds = selectedRefreshVenueIds();
  if (!venueIds.length) {
    setStatus("Tick at least one venue in Saved results before refreshing.");
    syncRefreshSelectionUi();
    return;
  }
  await startRefreshJob({
    venueIds,
    scanMode: "fast",
    label: venueIds.length > 1 ? `Refresh ${venueIds.length} selected` : "Refresh selected",
  });
}

async function refreshAllVenues() {
  if (!confirmRefreshAll()) return;
  resetRefreshAllConfirm();
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
    throw new Error("Sync to the web app first, then use the availability page.");
  }

  const stored = await chrome.storage.local.get(SYNC_CONFIG_KEY);
  const config = stored[SYNC_CONFIG_KEY] || {};
  const venueId = latestPayload.venue_id || selectedVenueId;
  if (!venueId) throw new Error("Select a venue before opening an availability link.");

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
    setStatus("Copied availability link.");
  } catch (error) {
    setStatus(error?.message || String(error));
  }
}

async function plannerLink() {
  const stored = await chrome.storage.local.get(SYNC_CONFIG_KEY);
  const config = stored[SYNC_CONFIG_KEY] || {};
  const base = normalizeShareUrlBase(config.shareUrlBase);
  const venueIds = selectedRefreshVenueIds();
  const selectedIds = venueIds.length ? venueIds : selectedVenueId ? [selectedVenueId] : [];
  if (!selectedIds.length) throw new Error("Select at least one venue before creating a planner.");
  return `${base}/planner/new?venues=${encodeURIComponent(selectedIds.join(","))}`;
}

async function createGroupPlanner() {
  try {
    const link = await plannerLink();
    await chrome.tabs.create({ url: link });
    setStatus("Opened planner setup.");
  } catch (error) {
    setStatus(error?.message || String(error));
  }
}

function formatProbeIntervals(intervals) {
  return Array.isArray(intervals) && intervals.length
    ? intervals.map((interval) => `${interval.start_time || "?"}-${interval.end_time || "?"}`).join(", ")
    : "none";
}

function probeSummary(payload = latestPayload) {
  const days = Array.isArray(payload?.days) ? payload.days : [];
  const lines = [
    `${payload?.venue_name || "ProPickle"} probe summary`,
    `venue_id: ${payload?.venue_id || selectedVenueId || "unknown"}`,
    `exported_at: ${payload?.exported_at || "unknown"}`,
  ];

  for (const day of days) {
    const probes = Array.isArray(day.probe_debug) ? day.probe_debug : [];
    if (!probes.length) continue;

    lines.push("", day.date || "Unknown date");
    lines.push(`  continuity_status: ${day.continuity_status || "unknown"}`);
    lines.push(`  any-court: ${formatProbeIntervals(day.open_intervals)}`);
    const sameCourt = Array.isArray(day.same_court_intervals) ? day.same_court_intervals : [];
    lines.push("  same-court:");
    if (sameCourt.length) {
      for (const group of sameCourt) {
        const court = group.court_name || group.courtName || group.resource_name || group.provider_name || "?";
        lines.push(`    ${court}: ${formatProbeIntervals(group.intervals)}`);
      }
    } else {
      lines.push("    none");
    }
    if (/\bjuly\s+16\b/i.test(day.date || "")) {
      const failures = ProPickleProbeTarget.targetSplitFailures(day);
      lines.push(`  target split: ${failures.length ? "FAIL" : "PASS"}`);
      for (const failure of failures) lines.push(`    - ${failure}`);
    }

    const groups = new Map();
    for (const probe of probes) {
      const key = `${probe.start_time || "?"}-${probe.end_time || "?"}`;
      groups.set(key, [...(groups.get(key) || []), probe]);
    }

    for (const [time, timeProbes] of groups.entries()) {
      const accepted = timeProbes
        .filter((probe) => probe.accepted)
        .map((probe) => probe.court_name || "?");
      const rejected = timeProbes
        .filter((probe) => !probe.accepted)
        .map((probe) => {
          const state = probe.option_state?.disabled_by || probe.option_state?.class_name || "";
          return `${probe.court_name || "?"} (${probe.reason || "rejected"}${state ? `; ${state}` : ""})`;
        });
      lines.push(`  ${time}`);
      lines.push(`    accepted: ${accepted.length ? accepted.join(", ") : "none"}`);
      lines.push(`    rejected: ${rejected.length ? rejected.join(", ") : "none"}`);
    }
  }

  return lines.join("\n").trim();
}

async function copyProbeSummary() {
  try {
    if (!hasProbeDebug()) {
      setStatus("No ProPickle probe diagnostics saved yet. Refresh ProPickle first.");
      return;
    }
    await navigator.clipboard.writeText(probeSummary());
    setStatus("Copied probe summary.");
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
    "Deep scan checks each court/provider and can take a while on slow venues. It opens a small reader window; keep that window visible so Chrome does not throttle the read. It is read-only, but slower than normal refresh. Continue?"
  );
}

function confirmRefreshAll() {
  const now = Date.now();
  if (now < refreshAllConfirmUntil) return true;

  refreshAllConfirmUntil = now + 5000;
  refreshAllButton.classList.add("is-confirming");
  refreshAllButton.textContent = "Confirm Refresh all";
  setStatus(
    "Refresh all may use a separate reader window and slow venues can take a while. Click Confirm Refresh all within 5 seconds to continue."
  );

  if (refreshAllConfirmTimer) clearTimeout(refreshAllConfirmTimer);
  refreshAllConfirmTimer = setTimeout(resetRefreshAllConfirm, 5000);
  return false;
}

function resetRefreshAllConfirm() {
  refreshAllConfirmUntil = 0;
  if (refreshAllConfirmTimer) clearTimeout(refreshAllConfirmTimer);
  refreshAllConfirmTimer = null;
  refreshAllButton.classList.remove("is-confirming");
  refreshAllButton.textContent = "Refresh all";
}

async function init() {
  const response = await sendMessage({ type: MESSAGE.LIST_VENUES });
  if (!response?.ok) throw new Error(response?.error || "Could not load venues.");

  venues = response.venues || [];
  selectedVenueId = response.selectedVenueId || AvailabilityRegistry.DEFAULT_VENUE_ID;
  refreshSelection = new Set(selectedVenueId ? [selectedVenueId] : []);
  populateVenues();
  await loadRefreshHistory();
  await refreshVenueStatusList();
  await loadSavedPayload();
  await loadRefreshJobStatus({ silentWhenInactive: true });
}

venueSelect.addEventListener("change", () => {
  selectVenue(venueSelect.value).catch((error) => setStatus(error?.message || String(error)));
});
venueStatusListElement.addEventListener("change", (event) => {
  const target = event.target;
  if (!target?.classList?.contains("venue-status-check")) return;
  if (target.checked) {
    refreshSelection.add(target.value);
  } else {
    refreshSelection.delete(target.value);
  }
  syncRefreshSelectionUi();
  setSavedSummary();
});
venueStatusListElement.addEventListener("click", (event) => {
  const button = event.target?.closest?.(".venue-status-view");
  if (!button?.dataset?.venueId || button.dataset.venueId === selectedVenueId) return;
  selectVenue(button.dataset.venueId).catch((error) => setStatus(error?.message || String(error)));
});
refreshVenueButton.addEventListener("click", () => refreshVenue());
refreshStaleButton.addEventListener("click", () => refreshStaleVenues());
refreshAllButton.addEventListener("click", () => refreshAllVenues());
deepScanVenueButton.addEventListener("click", () => deepScanVenue());
readCurrentPageButton.addEventListener("click", readCurrentPage);
viewAvailabilityButton.addEventListener("click", viewAvailability);
copyShareLinkButton.addEventListener("click", copyShareLink);
createPlannerButton.addEventListener("click", createGroupPlanner);
copyProbeSummaryButton.addEventListener("click", copyProbeSummary);
openSetupWindowButton.addEventListener("click", () => {
  openSetupWindow().catch((error) => setStatus(error?.message || String(error)));
});

init().catch((error) => {
  setBusy(false);
  renderEmpty(error?.message || String(error));
});
