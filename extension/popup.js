const readButton = document.querySelector("#readButton");
const copyButton = document.querySelector("#copyButton");
const downloadButton = document.querySelector("#downloadButton");
const statusElement = document.querySelector("#status");
const actionsElement = document.querySelector("#actions");
const resultsElement = document.querySelector("#results");

let latestPayload = null;

function setStatus(message) {
  statusElement.textContent = message;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  return tab;
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["contentScript.js"],
  });
}

function sendReadMessage(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "PLAYBYPOINT_READ_AVAILABILITY" });
}

function render(payload) {
  latestPayload = payload;
  actionsElement.hidden = false;
  resultsElement.replaceChildren();

  for (const day of payload.days || []) {
    const section = document.createElement("section");
    section.className = "day";

    const title = document.createElement("h2");
    title.textContent = day.date || "Unknown date";
    section.append(title);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${day.title || "Court booking"} • ${day.remaining_hours || 0} open hour(s)`;
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

async function readPage() {
  readButton.disabled = true;
  actionsElement.hidden = true;
  resultsElement.replaceChildren();
  setStatus("Reading visible day tabs...");

  try {
    const tab = await activeTab();
    await ensureContentScript(tab.id);
    const response = await sendReadMessage(tab.id);
    if (!response?.ok) throw new Error(response?.error || "Reader failed.");
    render(response.payload);
    setStatus(`Read ${(response.payload.days || []).length} day(s).`);
  } catch (error) {
    setStatus(error?.message || String(error));
  } finally {
    readButton.disabled = false;
  }
}

async function copyJson() {
  if (!latestPayload) return;
  await navigator.clipboard.writeText(JSON.stringify(latestPayload, null, 2));
  setStatus("Copied JSON to clipboard.");
}

function downloadJson() {
  if (!latestPayload) return;
  const blob = new Blob([JSON.stringify(latestPayload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "browser_availability.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Downloaded browser_availability.json.");
}

readButton.addEventListener("click", readPage);
copyButton.addEventListener("click", copyJson);
downloadButton.addEventListener("click", downloadJson);
