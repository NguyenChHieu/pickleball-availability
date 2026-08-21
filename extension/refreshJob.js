// Refresh job engine: runs one or more venue refreshes (parallel for "fast"
// scans, serial for "deep"), tracks the active job and its history. Owns
// activeRefreshJob/refreshJobPromise/refreshJobStartPromise/refreshJobStarting
// as module-private state - the busiest of the extracted seams, sitting on
// top of tabReader.js, readerWindow.js, and pendingRefresh.js (it creates
// pending-refresh sessions when a venue needs manual setup, via
// pendingRefreshSession/savePendingRefresh).

import { AvailabilityRegistry } from "./venues.js";
import { beginRefreshAttempt, reportRefreshStatus } from "./sync.js";
import { cacheFirstPayload, readTab, saveVenuePayload, venueForScanMode, wait, waitForTabComplete } from "./tabReader.js";
import { activateTab, closeTab, focusTab, releaseRefreshReaderWindow, tabForVenue } from "./readerWindow.js";
import {
  clearPendingRefresh,
  loadPendingRefreshes,
  normalizeRefreshSource,
  pendingRefreshSession,
  savePendingRefresh,
} from "./pendingRefresh.js";

const REFRESH_JOB_KEY = "activeRefreshJob";
const REFRESH_HISTORY_KEY = "refreshJobHistory";
const MAX_REFRESH_HISTORY = 5;
const MAX_PARALLEL_REFRESHES = 3;

const venueDisplayName = (venue) => venue?.displayName || venue?.name || "Venue";

let refreshJobPromise = null;
let refreshJobStartPromise = null;
let refreshJobStarting = false;
let activeRefreshJob = null;

async function refreshVenueNow(venueId, scanMode = "fast", source = "selected") {
  const venue = AvailabilityRegistry.getVenue(venueId);
  const cachedPayload = await cacheFirstPayload(venue, scanMode);
  if (cachedPayload) {
    return {
      venue,
      payload: cachedPayload,
      syncStatus: { ok: true, skipped: true, reason: "Reused recent local cache." },
      manualSetupRequired: false,
      cacheHit: true,
    };
  }

  const refreshAttempt = await beginRefreshAttempt(venue.id);

  const readVenue = venueForScanMode(venue, scanMode);
  readVenue.scanMode = scanMode;
  readVenue.refreshSource = source;
  const { tab, closeWhenDone } = await tabForVenue(readVenue);

  try {
    if (scanMode === "deep") await focusTab(tab.id);
    await waitForTabComplete(tab.id);
    await wait(1200);
    const payload = await readTab(tab.id, readVenue);
    const syncStatus = await saveVenuePayload(venue.id, payload, refreshAttempt);
    if (closeWhenDone) await closeTab(tab.id);
    return { venue, payload, syncStatus, manualSetupRequired: false, refreshAttempt };
  } catch (error) {
    let readError = error;
    if (!readError.manualSetupRequired && readVenue.retryActiveOnFailure && tab.id) {
      try {
        if (scanMode === "deep") {
          await focusTab(tab.id);
        } else {
          await activateTab(tab.id);
        }
        await wait(1800);
        const payload = await readTab(tab.id, readVenue);
        const syncStatus = await saveVenuePayload(venue.id, payload, refreshAttempt);
        if (closeWhenDone) await closeTab(tab.id);
        return { venue, payload, syncStatus, manualSetupRequired: false, refreshAttempt };
      } catch (retryError) {
        readError = retryError.manualSetupRequired
          ? retryError
          : new Error(`${retryError?.message || String(retryError)} Retried after focusing the tab.`);
      }
    }

    if (!readError.manualSetupRequired) {
      if (closeWhenDone && tab.id) await closeTab(tab.id);
      readError.refreshAttempt = refreshAttempt;
      throw readError;
    }

    if (!tab.id) {
      return {
        venue,
        payload: null,
        manualSetupRequired: true,
        pendingRefresh: false,
        error: "Manual setup needed, but the booking tab is no longer available.",
        refreshAttempt,
      };
    }

    await savePendingRefresh(
      pendingRefreshSession(tab.id, readVenue, closeWhenDone, readError, refreshAttempt)
    );
    return {
      venue,
      payload: null,
      manualSetupRequired: true,
      pendingRefresh: true,
      error: readError?.message || String(readError),
      refreshAttempt,
    };
  }
}

export async function openPendingSetupWindow(venueId = "") {
  const pendingRefreshes = await loadPendingRefreshes();
  const candidates = Object.values(pendingRefreshes)
    .filter((session) => !venueId || session?.venueId === venueId)
    .sort((left, right) => Number(right?.startedAt || 0) - Number(left?.startedAt || 0));

  for (const session of candidates) {
    const tab = await chrome.tabs.get(Number(session?.tabId)).catch(() => null);
    if (!tab?.id) {
      await clearPendingRefresh(Number(session?.tabId));
      continue;
    }
    await focusTab(tab.id);
    return { venueId: session.venueId, tabId: tab.id };
  }

  throw new Error("No setup window is waiting. Start the venue refresh again.");
}

export async function pendingSetupVenueIds() {
  const pendingRefreshes = await loadPendingRefreshes();
  const now = Date.now();
  return [
    ...new Set(
      Object.values(pendingRefreshes)
        .filter((session) => Number(session?.expiresAt || 0) > now)
        .map((session) => session?.venueId)
        .filter(Boolean)
    ),
  ];
}

function isActiveRefreshJob(job) {
  return job?.status === "queued" || job?.status === "running";
}

function refreshJobSummary(job) {
  const results = Array.isArray(job?.results) ? job.results : [];
  const failed = results.filter((result) => result.status === "failed").length;
  const setupRequired = results.filter((result) => result.status === "setup_required").length;
  const succeeded = results.filter((result) => result.status === "success").length;
  const syncFailed = results.filter(
    (result) => result.status === "success" && result.syncOk === false && !result.syncSkipped
  ).length;
  return { failed, setupRequired, succeeded, syncFailed };
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

export async function storedRefreshHistory() {
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
    source: job.source || normalizeRefreshSource("", job.scanMode, job.label),
    parallelLimit: Number(job.parallelLimit || 1),
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

export async function currentRefreshJob() {
  const job = activeRefreshJob || (await storedRefreshJob());
  if (isActiveRefreshJob(job) && !refreshJobPromise && !refreshJobStarting) {
    const interruptedJob = await saveRefreshJob({
      ...job,
      status: "failed",
      error: "Refresh was interrupted. Start it again when you are ready.",
      updatedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });
    await recordRefreshJob(interruptedJob).catch((error) => console.warn(error));
    return interruptedJob;
  }
  return job;
}

function normalizeRefreshJobVenues(venueIds) {
  const allVenueIds = AvailabilityRegistry.getVenues().map((venue) => venue.id);
  const requested = Array.isArray(venueIds) && venueIds.length ? venueIds : [allVenueIds[0]];
  const normalized = requested.filter((venueId, index) => allVenueIds.includes(venueId) && requested.indexOf(venueId) === index);
  return normalized.length ? normalized : [allVenueIds[0]];
}

function refreshReportStatus(result) {
  if (result.status === "success" && result.syncOk === false) return "failed";
  if (result.cacheHit || result.superseded) return "cache_reused";
  return result.status;
}

function makeRefreshJob({ venueIds, scanMode = "fast", label = "", source = "" }) {
  const normalizedVenueIds = normalizeRefreshJobVenues(venueIds);
  const now = new Date().toISOString();
  const parallelLimit = scanMode === "deep" ? 1 : Math.min(MAX_PARALLEL_REFRESHES, normalizedVenueIds.length);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: "queued",
    label,
    scanMode,
    source: normalizeRefreshSource(source, scanMode, label),
    parallelLimit,
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

async function refreshVenueForJob(venueId, scanMode, source) {
  const venue = AvailabilityRegistry.getVenue(venueId);
  const startedAt = Date.now();
  const durationMs = () => Date.now() - startedAt;
  let jobResult;
  let refreshAttempt = null;
  try {
    const result = await refreshVenueNow(venue.id, scanMode, source);
    refreshAttempt = result.refreshAttempt || null;
    if (result.manualSetupRequired) {
      jobResult = {
        venueId: venue.id,
        venueName: venueDisplayName(venue),
        status: "setup_required",
        message: result.error || "Manual setup required.",
        pendingRefresh: Boolean(result.pendingRefresh),
        durationMs: durationMs(),
      };
    } else {
      jobResult = {
        venueId: venue.id,
        venueName: venueDisplayName(venue),
        status: "success",
        dayCount: Array.isArray(result.payload?.days) ? result.payload.days.length : 0,
        syncOk: Boolean(result.syncStatus?.ok),
        syncSkipped: Boolean(result.syncStatus?.skipped),
        syncMessage: result.syncStatus?.error || result.syncStatus?.reason || "",
        cacheHit: Boolean(result.cacheHit || result.syncStatus?.superseded),
        superseded: Boolean(result.syncStatus?.superseded),
        durationMs: durationMs(),
      };
    }
  } catch (error) {
    refreshAttempt = error?.refreshAttempt || null;
    jobResult = {
      venueId: venue.id,
      venueName: venueDisplayName(venue),
      status: "failed",
      message: error?.message || String(error),
      durationMs: durationMs(),
    };
  }

  await reportRefreshStatus(
    venue.id,
    {
      status: refreshReportStatus(jobResult),
      duration_ms: Math.min(30 * 60 * 1000, Math.max(0, Number(jobResult.durationMs || 0))),
      source: normalizeRefreshSource(source, scanMode),
    },
    refreshAttempt
  );
  return jobResult;
}

async function runRefreshJobInParallel(job, results) {
  let nextIndex = 0;
  let latestJob = job;
  let progressUpdate = Promise.resolve();
  const workerCount = Math.min(Number(job.parallelLimit || MAX_PARALLEL_REFRESHES), job.venueIds.length);

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

      const result = await refreshVenueForJob(venueId, job.scanMode, job.source);
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
  const isParallelRefresh = Number(job.parallelLimit || 1) > 1 && job.venueIds.length > 1;

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

      results.push(await refreshVenueForJob(venue.id, job.scanMode, job.source));

      job = await updateRefreshJob(job, {
        completed: results.length,
        results,
      });

      await wait(600);
    }
  }

  const summary = refreshJobSummary({ results });
  const finishedJob = await updateRefreshJob(job, {
    status:
      summary.failed || summary.setupRequired || summary.syncFailed
        ? "completed_with_issues"
        : "completed",
    completed: results.length,
    currentVenueId: "",
    currentVenueName: "",
    results,
    finishedAt: new Date().toISOString(),
  });
  await recordRefreshJob(finishedJob).catch((error) => console.warn(error));
  return finishedJob;
}

async function startRefreshJobLocked(request = {}) {
  const existingJob = await currentRefreshJob();
  if (isActiveRefreshJob(existingJob) || refreshJobPromise) return { job: existingJob, alreadyRunning: true };

  const job = makeRefreshJob(request);
  refreshJobStarting = true;
  try {
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
      .finally(async () => {
        if (job.scanMode !== "deep") {
          await releaseRefreshReaderWindow().catch((error) => console.warn(error));
        }
        refreshJobPromise = null;
      });
  } finally {
    refreshJobStarting = false;
  }

  return { job, alreadyRunning: false };
}

export async function startRefreshJob(request = {}) {
  if (refreshJobStartPromise) {
    const result = await refreshJobStartPromise;
    return { ...result, alreadyRunning: true };
  }

  refreshJobStartPromise = startRefreshJobLocked(request);
  try {
    return await refreshJobStartPromise;
  } finally {
    refreshJobStartPromise = null;
  }
}
