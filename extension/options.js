const SYNC_CONFIG_KEY = "backendSyncConfig";

const enabledInput = document.querySelector("#enabled");
const backendUrlInput = document.querySelector("#backendUrl");
const syncTokenInput = document.querySelector("#syncToken");
const saveButton = document.querySelector("#saveButton");
const statusElement = document.querySelector("#status");

function setStatus(message) {
  statusElement.textContent = message;
}

function normalizeBackendUrl(value) {
  return (value || "http://localhost:8787").trim().replace(/\/+$/, "");
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(SYNC_CONFIG_KEY);
  const config = stored[SYNC_CONFIG_KEY] || {};
  enabledInput.checked = Boolean(config.enabled);
  backendUrlInput.value = config.backendUrl || "http://localhost:8787";
  syncTokenInput.value = config.syncToken || "";
}

async function saveSettings() {
  const backendUrl = normalizeBackendUrl(backendUrlInput.value);
  try {
    new URL(backendUrl);
  } catch {
    setStatus("Enter a valid backend URL.");
    return;
  }

  await chrome.storage.local.set({
    [SYNC_CONFIG_KEY]: {
      enabled: enabledInput.checked,
      backendUrl,
      syncToken: syncTokenInput.value,
    },
  });
  setStatus("Saved.");
}

saveButton.addEventListener("click", saveSettings);
loadSettings().catch((error) => setStatus(error?.message || String(error)));
