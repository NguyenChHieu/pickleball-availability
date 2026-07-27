const SYNC_CONFIG_KEY = "backendSyncConfig";
const OLD_LOCAL_BACKEND_URL = "http://localhost:8787";
const DEFAULT_BACKEND_URL = "http://localhost:3007";
const DEFAULT_SHARE_URL_BASE = "http://localhost:3007";
const DEFAULT_SHARE_TOKEN = "dev-share";
const CONNECTION_TEST_TIMEOUT_MS = 5000;
const TRUSTED_APP_HOSTS = new Set([
  "pickleball-availability.vercel.app",
  "pickleball-availability-tau.vercel.app",
]);
const TRUSTED_PREVIEW_HOST =
  /^pickleball-availability(?:-[a-z0-9-]+)*-henryngs-projects\.vercel\.app$/;

const enabledInput = document.querySelector("#enabled");
const backendUrlInput = document.querySelector("#backendUrl");
const syncTokenInput = document.querySelector("#syncToken");
const shareUrlBaseInput = document.querySelector("#shareUrlBase");
const shareTokenInput = document.querySelector("#shareToken");
const saveButton = document.querySelector("#saveButton");
const statusElement = document.querySelector("#status");

function setStatus(message) {
  statusElement.textContent = message;
}

function normalizeUrl(value, fallback) {
  return (value || fallback).trim().replace(/\/+$/, "");
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) return false;
    if (parsed.protocol === "http:") {
      return ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    }
    if (parsed.protocol !== "https:") return false;
    return TRUSTED_APP_HOSTS.has(parsed.hostname) || TRUSTED_PREVIEW_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

function refreshAttemptEndpoint(backendUrl) {
  const endpoint = new URL(backendUrl);
  const prefix = endpoint.pathname.replace(/\/+$/, "");
  endpoint.pathname = `${prefix}/api/availability/propickle/refresh-attempt`;
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint.toString();
}

async function verifyConnection({ backendUrl, syncToken }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TEST_TIMEOUT_MS);
  try {
    const headers = {};
    if (syncToken) headers["x-sync-token"] = syncToken;
    const response = await fetch(refreshAttemptEndpoint(backendUrl), {
      method: "POST",
      headers,
      signal: controller.signal,
    });
    if (response.status === 401) return "Saved, but the sync token was rejected.";
    if (response.status === 404) return "Saved, but this App URL does not provide availability sync.";
    if (!response.ok) return `Saved, but the connection check returned ${response.status}.`;
    const body = await response.json().catch(() => ({}));
    if (!body?.attempt_id || !body?.started_at) {
      return "Saved, but the App URL returned an unexpected response.";
    }
    return "Saved. Sync connection verified.";
  } catch (error) {
    if (error?.name === "AbortError") return "Saved, but the connection check timed out.";
    return "Saved, but the App URL could not be reached.";
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(SYNC_CONFIG_KEY);
  const config = stored[SYNC_CONFIG_KEY] || {};
  const backendUrl = config.backendUrl === OLD_LOCAL_BACKEND_URL ? DEFAULT_BACKEND_URL : config.backendUrl;
  enabledInput.checked = Boolean(config.enabled);
  backendUrlInput.value = backendUrl || DEFAULT_BACKEND_URL;
  syncTokenInput.value = config.syncToken || "";
  shareUrlBaseInput.value = config.shareUrlBase || DEFAULT_SHARE_URL_BASE;
  shareTokenInput.value = config.shareToken || DEFAULT_SHARE_TOKEN;
}

async function saveSettings() {
  const backendUrl = normalizeUrl(backendUrlInput.value, DEFAULT_BACKEND_URL);
  if (!isValidUrl(backendUrl)) {
    setStatus("Use this project's Vercel App URL, or localhost for development.");
    return;
  }

  const shareUrlBase = normalizeUrl(shareUrlBaseInput.value, backendUrl);
  if (!isValidUrl(shareUrlBase)) {
    setStatus("Use this project's Vercel Share URL, or localhost for development.");
    return;
  }

  const config = {
    enabled: enabledInput.checked,
    backendUrl,
    syncToken: syncTokenInput.value,
    shareUrlBase,
    shareToken: (shareTokenInput.value || DEFAULT_SHARE_TOKEN).trim(),
  };
  await chrome.storage.local.set({
    [SYNC_CONFIG_KEY]: config,
  });
  if (!config.enabled) {
    setStatus("Saved. Web app sync is off.");
    return;
  }

  setStatus("Saved. Checking connection...");
  setStatus(await verifyConnection(config));
}

saveButton.addEventListener("click", async () => {
  if (saveButton.disabled) return;
  saveButton.disabled = true;
  try {
    await saveSettings();
  } catch (error) {
    setStatus(error?.message || String(error));
  } finally {
    saveButton.disabled = false;
  }
});
loadSettings().catch((error) => setStatus(error?.message || String(error)));
