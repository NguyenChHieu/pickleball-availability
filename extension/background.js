importScripts("venues.js");

const MESSAGE = Object.freeze({
  LIST_VENUES: "AVAILABILITY_LIST_VENUES",
  GET_VENUE_PAYLOAD: "AVAILABILITY_GET_VENUE_PAYLOAD",
  SET_SELECTED_VENUE: "AVAILABILITY_SET_SELECTED_VENUE",
  START_REFRESH_JOB: "AVAILABILITY_START_REFRESH_JOB",
  GET_REFRESH_JOB: "AVAILABILITY_GET_REFRESH_JOB",
  GET_REFRESH_HISTORY: "AVAILABILITY_GET_REFRESH_HISTORY",
  READ_ACTIVE_TAB: "AVAILABILITY_READ_ACTIVE_TAB",
  READ_CURRENT_PAGE: "AVAILABILITY_READ_CURRENT_PAGE",
});

const PROVIDER_FILES = Object.freeze({
  "playbypoint-bookbox": "providers/playbypointBookBox.js",
  "clubspark-book-by-date": "providers/clubsparkBookByDate.js",
  "mindbody-appointments": "providers/mindbodyAppointments.js",
  "playtomic-availability": "providers/playtomicAvailability.js",
  "podplay-dom": "providers/podplayDom.js",
  "hamlet-experience": "providers/hamletExperience.js",
});

const SYNC_CONFIG_KEY = "backendSyncConfig";
const OLD_LOCAL_BACKEND_URL = "http://localhost:8787";
const DEFAULT_BACKEND_URL = "http://localhost:3007";
const PENDING_REFRESH_KEY = "pendingVenueRefreshes";
const REFRESH_JOB_KEY = "activeRefreshJob";
const REFRESH_HISTORY_KEY = "refreshJobHistory";
const MAX_REFRESH_HISTORY = 5;
const MAX_PARALLEL_REFRESHES = 3;
const PENDING_REFRESH_TTL_MS = 5 * 60 * 1000;
const PENDING_REFRESH_RETRY_MS = 8000;

const pendingRefreshAttempts = new Set();
const pendingRefreshTimers = new Map();
let refreshJobPromise = null;
let activeRefreshJob = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const venueDisplayName = (venue) => venue?.displayName || venue?.name || "Venue";

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

function venueForScanMode(venue, scanMode = "fast") {
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

async function saveVenuePayload(venueId, payload) {
  await chrome.storage.local.set({ [AvailabilityRegistry.venuePayloadKey(venueId)]: payload });
  return syncVenuePayload(venueId, payload);
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

async function cacheFirstPayload(venue, scanMode) {
  if (scanMode !== "cache-first" || !Number(venue.cacheFirstTtlMs || 0)) return null;

  const payload = await storedVenuePayload(venue.id);
  if (!payload) return null;

  return payloadAgeMs(payload) <= Number(venue.cacheFirstTtlMs) ? payload : null;
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
    scanMode: venue.scanMode || "fast",
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
    const readVenue = venueForScanMode(venue, session.scanMode);
    const tab = await chrome.tabs.get(Number(tabId)).catch(() => null);
    if (shouldReturnToVenueStart(tab, readVenue, session, null)) {
      await returnPendingRefreshToVenueStart(tabId, readVenue, session, null);
      return null;
    }

    await wait(300);
    const payload = await readTab(Number(tabId), readVenue);
    const syncStatus = await saveVenuePayload(venue.id, payload);
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
    console.warn(error);
    return null;
  } finally {
    pendingRefreshAttempts.delete(key);
  }
}

async function refreshVenueNow(venueId, scanMode = "fast") {
  const venue = AvailabilityRegistry.getVenue(venueId);
  const cachedPayload = await cacheFirstPayload(venue, scanMode);
  if (cachedPayload) {
    return {
      venue,
      payload: cachedPayload,
      syncStatus: await syncVenuePayload(venue.id, cachedPayload),
      manualSetupRequired: false,
      cacheHit: true,
    };
  }

  const readVenue = venueForScanMode(venue, scanMode);
  readVenue.scanMode = scanMode;
  const { tab, closeWhenDone } = await tabForVenue(readVenue);

  try {
    await waitForTabComplete(tab.id);
    await wait(1200);
    const payload = await readTab(tab.id, readVenue);
    const syncStatus = await saveVenuePayload(venue.id, payload);
    if (closeWhenDone) await closeTab(tab.id);
    return { venue, payload, syncStatus, manualSetupRequired: false };
  } catch (error) {
    let readError = error;
    if (!readError.manualSetupRequired && readVenue.retryActiveOnFailure && tab.id) {
      try {
        await activateTab(tab.id);
        await wait(1800);
        const payload = await readTab(tab.id, readVenue);
        const syncStatus = await saveVenuePayload(venue.id, payload);
        if (closeWhenDone) await closeTab(tab.id);
        return { venue, payload, syncStatus, manualSetupRequired: false };
      } catch (retryError) {
        readError = retryError.manualSetupRequired
          ? retryError
          : new Error(`${retryError?.message || String(retryError)} Retried after focusing the tab.`);
      }
    }

    if (!readError.manualSetupRequired) {
      if (closeWhenDone && tab.id) await closeTab(tab.id);
      throw readError;
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
    await savePendingRefresh(pendingRefreshSession(tab.id, readVenue, closeWhenDone, readError));
    return {
      venue,
      payload: null,
      manualSetupRequired: true,
      pendingRefresh: true,
      error: readError?.message || String(readError),
    };
  }
}

function isActiveRefreshJob(job) {
  return job?.status === "queued" || job?.status === "running";
}

function refreshJobSummary(job) {
  const results = Array.isArray(job?.results) ? job.results : [];
  const failed = results.filter((result) => result.status === "failed").length;
  const setupRequired = results.filter((result) => result.status === "setup_required").length;
  const succeeded = results.filter((result) => result.status === "success").length;
  return { failed, setupRequired, succeeded };
}

async function saveRefreshJob(job) {
  activeRefreshJob = job;
  await chrome.storage.local.set({ [REFRESH_JOB_KEY]: job });
  return job;
}

async function storedRefreshJob() {
  const stored = await chrome.storage.local.get(REFRESH_JOB_KEY);
  return stored[REFRESH_JOB_KEY] || null;
}

async function storedRefreshHistory() {
  const stored = await chrome.storage.local.get(REFRESH_HISTORY_KEY);
  return Array.isArray(stored[REFRESH_HISTORY_KEY]) ? stored[REFRESH_HISTORY_KEY] : [];
}

async function recordRefreshJob(job) {
  if (isActiveRefreshJob(job)) return;
  const finishedAt = job.finishedAt || job.updatedAt || new Date().toISOString();
  const entry = {
    id: job.id,
    label: job.label || "",
    scanMode: job.scanMode || "fast",
    status: job.status || "failed",
    total: Number(job.total || job.venueIds?.length || 0),
    completed: Number(job.completed || 0),
    startedAt: job.startedAt || finishedAt,
    finishedAt,
    results: Array.isArray(job.results) ? job.results : [],
    error: job.error || "",
  };
  const history = await storedRefreshHistory();
  const nextHistory = [entry, ...history.filter((item) => item.id !== entry.id)].slice(0, MAX_REFRESH_HISTORY);
  await chrome.storage.local.set({ [REFRESH_HISTORY_KEY]: nextHistory });
}

async function currentRefreshJob() {
  const job = activeRefreshJob || (await storedRefreshJob());
  if (isActiveRefreshJob(job) && !refreshJobPromise) {
    return saveRefreshJob({
      ...job,
      status: "failed",
      error: "Refresh was interrupted. Start it again when you are ready.",
      updatedAt: new Date().toISOString(),
    });
  }
  return job;
}

function normalizeRefreshJobVenues(venueIds) {
  const allVenueIds = AvailabilityRegistry.getVenues().map((venue) => venue.id);
  const requested = Array.isArray(venueIds) && venueIds.length ? venueIds : [allVenueIds[0]];
  const normalized = requested.filter((venueId, index) => allVenueIds.includes(venueId) && requested.indexOf(venueId) === index);
  return normalized.length ? normalized : [allVenueIds[0]];
}

function makeRefreshJob({ venueIds, scanMode = "fast", label = "" }) {
  const normalizedVenueIds = normalizeRefreshJobVenues(venueIds);
  const now = new Date().toISOString();
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: "queued",
    label,
    scanMode,
    venueIds: normalizedVenueIds,
    total: normalizedVenueIds.length,
    completed: 0,
    currentVenueId: "",
    currentVenueName: "",
    results: [],
    startedAt: now,
    updatedAt: now,
  };
}

async function updateRefreshJob(job, updates) {
  return saveRefreshJob({
    ...job,
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

async function refreshVenueForJob(venueId, scanMode) {
  const venue = AvailabilityRegistry.getVenue(venueId);
  const startedAt = Date.now();
  const durationMs = () => Date.now() - startedAt;
  try {
    const result = await refreshVenueNow(venue.id, scanMode);
    if (result.manualSetupRequired) {
      return {
        venueId: venue.id,
        venueName: venueDisplayName(venue),
        status: "setup_required",
        message: result.error || "Manual setup required.",
        pendingRefresh: Boolean(result.pendingRefresh),
        durationMs: durationMs(),
      };
    }

    return {
      venueId: venue.id,
      venueName: venueDisplayName(venue),
      status: "success",
      dayCount: Array.isArray(result.payload?.days) ? result.payload.days.length : 0,
      syncOk: Boolean(result.syncStatus?.ok),
      syncMessage: result.syncStatus?.error || result.syncStatus?.reason || "",
      cacheHit: Boolean(result.cacheHit),
      durationMs: durationMs(),
    };
  } catch (error) {
    return {
      venueId: venue.id,
      venueName: venueDisplayName(venue),
      status: "failed",
      message: error?.message || String(error),
      durationMs: durationMs(),
    };
  }
}

async function runRefreshJobInParallel(job, results) {
  let nextIndex = 0;
  let latestJob = job;
  let progressUpdate = Promise.resolve();
  const workerCount = Math.min(MAX_PARALLEL_REFRESHES, job.venueIds.length);

  async function saveProgress() {
    progressUpdate = progressUpdate.then(async () => {
      latestJob = await updateRefreshJob(latestJob, {
        completed: results.length,
        results: [...results],
      });
    });
    await progressUpdate;
  }

  async function worker() {
    while (nextIndex < job.venueIds.length) {
      const venueId = job.venueIds[nextIndex];
      nextIndex += 1;

      const result = await refreshVenueForJob(venueId, job.scanMode);
      results.push(result);
      results.sort((left, right) => job.venueIds.indexOf(left.venueId) - job.venueIds.indexOf(right.venueId));
      await saveProgress();
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return latestJob;
}

async function runRefreshJob(initialJob) {
  let job = await updateRefreshJob(initialJob, { status: "running" });
  const results = [];
  const isParallelRefresh = job.scanMode !== "deep" && job.venueIds.length > 1;

  if (isParallelRefresh) {
    job = await updateRefreshJob(job, {
      currentVenueId: "",
      currentVenueName: "Multiple venues",
      completed: 0,
      results,
    });

    job = await runRefreshJobInParallel(job, results);
  } else {
    for (const venueId of job.venueIds) {
      const venue = AvailabilityRegistry.getVenue(venueId);
      job = await updateRefreshJob(job, {
        currentVenueId: venue.id,
        currentVenueName: venueDisplayName(venue),
        completed: results.length,
        results,
      });

      results.push(await refreshVenueForJob(venue.id, job.scanMode));

      job = await updateRefreshJob(job, {
        completed: results.length,
        results,
      });

      await wait(600);
    }
  }

  const summary = refreshJobSummary({ results });
  const finishedJob = await updateRefreshJob(job, {
    status: summary.failed || summary.setupRequired ? "completed_with_issues" : "completed",
    completed: results.length,
    currentVenueId: "",
    currentVenueName: "",
    results,
    finishedAt: new Date().toISOString(),
  });
  await recordRefreshJob(finishedJob).catch((error) => console.warn(error));
  return finishedJob;
}

async function startRefreshJob(request = {}) {
  const existingJob = await currentRefreshJob();
  if (isActiveRefreshJob(existingJob)) return { job: existingJob, alreadyRunning: true };

  const job = makeRefreshJob(request);
  await saveRefreshJob(job);
  refreshJobPromise = runRefreshJob(job)
    .catch(async (error) => {
      const failedJob = await updateRefreshJob(job, {
        status: "failed",
        error: error?.message || String(error),
        finishedAt: new Date().toISOString(),
      });
      await recordRefreshJob(failedJob).catch((historyError) => console.warn(historyError));
      return failedJob;
    })
    .finally(() => {
      refreshJobPromise = null;
    });

  return { job, alreadyRunning: false };
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
    if (message?.type === MESSAGE.START_REFRESH_JOB) return startRefreshJob(message);
    if (message?.type === MESSAGE.GET_REFRESH_JOB) return { job: await currentRefreshJob() };
    if (message?.type === MESSAGE.GET_REFRESH_HISTORY) return { history: await storedRefreshHistory() };
    if (message?.type === MESSAGE.READ_ACTIVE_TAB) return readActiveTab();
    throw new Error("Unknown availability message.");
  })()
    .then((payload) => sendResponse({ ok: true, ...payload }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));

  return true;
});
