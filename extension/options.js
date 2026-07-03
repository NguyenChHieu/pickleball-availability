const SYNC_CONFIG_KEY = "backendSyncConfig";
const OLD_LOCAL_BACKEND_URL = "http://localhost:8787";
const DEFAULT_BACKEND_URL = "http://localhost:3007";
const DEFAULT_SHARE_URL_BASE = "http://localhost:3007";
const DEFAULT_SHARE_TOKEN = "dev-share";

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
    new URL(value);
    return true;
  } catch {
    return false;
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
    setStatus("Enter a valid backend URL.");
    return;
  }

  const shareUrlBase = normalizeUrl(shareUrlBaseInput.value, backendUrl);
  if (!isValidUrl(shareUrlBase)) {
    setStatus("Enter a valid share URL base.");
    return;
  }

  await chrome.storage.local.set({
    [SYNC_CONFIG_KEY]: {
      enabled: enabledInput.checked,
      backendUrl,
      syncToken: syncTokenInput.value,
      shareUrlBase,
      shareToken: (shareTokenInput.value || DEFAULT_SHARE_TOKEN).trim(),
    },
  });
  setStatus("Saved.");
}

saveButton.addEventListener("click", saveSettings);
loadSettings().catch((error) => setStatus(error?.message || String(error)));
