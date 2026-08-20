// Sync client: talks to the web app's availability API. Extracted from
// background.js as the first seam split - it has no shared mutable state
// with the rest of the service worker (reads config from storage, does
// fetch, done), unlike the refresh-job engine or reader-window management.

const SYNC_CONFIG_KEY = "backendSyncConfig";
const OLD_LOCAL_BACKEND_URL = "http://localhost:8787";
const DEFAULT_BACKEND_URL = "http://localhost:3007";
const REFRESH_STATUS_REPORT_TIMEOUT_MS = 2500;
const REFRESH_ATTEMPT_REQUEST_TIMEOUT_MS = 5000;
const SYNC_PAYLOAD_REQUEST_TIMEOUT_MS = 15000;

function payloadForSync(payload) {
  if (!payload || !Array.isArray(payload.days)) return payload;
  return {
    ...payload,
    days: payload.days.map(({ raw_slots: _rawSlots, probe_debug: _probeDebug, ...day }) => day),
  };
}

export function syncStatusKey(venueId) {
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

function refreshStatusEndpoint(backendUrl, venueId) {
  const base = new URL(backendUrl);
  const prefix = base.pathname.replace(/\/+$/, "");
  base.pathname = `${prefix}/api/availability/${encodeURIComponent(venueId)}/refresh-status`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

function refreshAttemptEndpoint(backendUrl, venueId) {
  const base = new URL(backendUrl);
  const prefix = base.pathname.replace(/\/+$/, "");
  base.pathname = `${prefix}/api/availability/${encodeURIComponent(venueId)}/refresh-attempt`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

export function normalizeStoredBackendUrl(backendUrl) {
  const normalized = backendUrl === OLD_LOCAL_BACKEND_URL ? DEFAULT_BACKEND_URL : backendUrl;
  return String(normalized || "").replace(/\/+$/, "");
}

export async function storedBackendSyncConfig() {
  const stored = await chrome.storage.local.get(SYNC_CONFIG_KEY);
  const config = stored[SYNC_CONFIG_KEY] || {};
  return {
    ...config,
    backendUrl: normalizeStoredBackendUrl(config.backendUrl),
  };
}

export async function beginRefreshAttempt(venueId) {
  const config = await storedBackendSyncConfig();
  if (!config.enabled || !config.backendUrl || !venueId) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REFRESH_ATTEMPT_REQUEST_TIMEOUT_MS);
  try {
    const headers = {};
    if (config.syncToken) headers["x-sync-token"] = config.syncToken;
    const response = await fetch(refreshAttemptEndpoint(config.backendUrl, venueId), {
      method: "POST",
      headers,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = await response.json();
    if (!body?.attempt_id || !body?.started_at) return null;
    return { attempt_id: body.attempt_id, started_at: body.started_at };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function syncVenuePayload(venueId, payload, refreshAttempt = null) {
  const config = await storedBackendSyncConfig();
  const backendUrl = config.backendUrl;
  if (!config.enabled || !backendUrl) {
    return {
      ok: false,
      skipped: true,
      reason: "Web app sync is off.",
    };
  }

  if (!refreshAttempt?.attempt_id || !refreshAttempt?.started_at) {
    const status = {
      ok: false,
      backend_url: backendUrl,
      failed_at: new Date().toISOString(),
      error:
        "Could not start a secure web sync. Availability was saved in the extension; check the App URL and sync token, then try again.",
    };
    await chrome.storage.local.set({ [syncStatusKey(venueId)]: status });
    return status;
  }

  const endpoint = availabilityEndpoint(backendUrl, venueId);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYNC_PAYLOAD_REQUEST_TIMEOUT_MS);

  try {
    const headers = { "content-type": "application/json" };
    if (config.syncToken) headers["x-sync-token"] = config.syncToken;
    if (refreshAttempt?.attempt_id && refreshAttempt?.started_at) {
      headers["x-refresh-attempt-id"] = refreshAttempt.attempt_id;
      headers["x-refresh-started-at"] = refreshAttempt.started_at;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payloadForSync(payload)),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Web app sync failed: ${response.status} ${body}`);
    }

    const body = await response.json().catch(() => ({}));
    const status = {
      ok: true,
      backend_url: backendUrl,
      accepted: body.accepted !== false,
      superseded: body.superseded === true,
      reason: body.superseded ? "A newer shared result was already saved." : "",
      synced_at: new Date().toISOString(),
    };
    await chrome.storage.local.set({ [syncStatusKey(venueId)]: status });
    return status;
  } catch (error) {
    const status = {
      ok: false,
      backend_url: backendUrl,
      failed_at: new Date().toISOString(),
      error: syncErrorMessage(error, endpoint),
    };
    await chrome.storage.local.set({ [syncStatusKey(venueId)]: status });
    return status;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function reportRefreshStatus(venueId, report, refreshAttempt = null) {
  const config = await storedBackendSyncConfig();
  if (!config.enabled || !config.backendUrl || !venueId) return { ok: false, skipped: true };
  if (!refreshAttempt?.attempt_id || !refreshAttempt?.started_at) {
    return { ok: false, skipped: true, reason: "No ordered refresh attempt was issued." };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REFRESH_STATUS_REPORT_TIMEOUT_MS);
  try {
    const headers = { "content-type": "application/json" };
    if (config.syncToken) headers["x-sync-token"] = config.syncToken;
    if (refreshAttempt?.attempt_id && refreshAttempt?.started_at) {
      headers["x-refresh-attempt-id"] = refreshAttempt.attempt_id;
      headers["x-refresh-started-at"] = refreshAttempt.started_at;
    }
    const response = await fetch(refreshStatusEndpoint(config.backendUrl, venueId), {
      method: "POST",
      headers,
      body: JSON.stringify(report),
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, status: response.status };
    const body = await response.json().catch(() => ({}));
    return { ok: true, persisted: body.persisted !== false };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function refreshStatusForSync(syncStatus) {
  if (syncStatus?.ok === false && !syncStatus?.skipped) return "failed";
  if (syncStatus?.superseded) return "cache_reused";
  return "success";
}

function syncErrorMessage(error, endpoint) {
  const message = error?.message || String(error);
  if (error?.name === "AbortError") {
    return `Timed out while syncing to ${endpoint}. The saved extension result is still available locally.`;
  }
  if (message === "Failed to fetch" || error?.name === "TypeError") {
    return `Failed to reach ${endpoint}. Check the App URL, extension permission, and web app health.`;
  }
  return message;
}

