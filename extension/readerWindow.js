// Shared reader-window/tab lifecycle: creates and reuses one unfocused
// browser window for "fast" venue refreshes, and one focused popup window
// per "deep" scan. Owns refreshReaderWindow/refreshReaderWindowPromise as
// module-private state - previously flat globals any function in
// background.js could read or mutate; now only this module can.
//
// Circular import with pendingRefresh.js: releaseRefreshReaderWindow needs
// loadPendingRefreshes to check whether any of this window's tabs still have
// a pending setup session before deciding whether to actually release it,
// and pendingRefresh.js needs focusTab/closeTab back. Verified this resolves
// correctly under real ES module semantics (Node's loader, same algorithm
// Chrome uses) - safe here because neither side calls into the other during
// module evaluation, only later from chrome.* event handlers.

import { loadPendingRefreshes } from "./pendingRefresh.js";

const READER_WINDOW_WIDTH = 760;
const READER_WINDOW_HEIGHT = 900;

let refreshReaderWindow = null;
let refreshReaderWindowPromise = null;

async function createDeepReaderWindow(venue) {
  const readerWindow = await chrome.windows.create({
    url: venue.startUrl,
    type: "popup",
    focused: true,
    width: READER_WINDOW_WIDTH,
    height: READER_WINDOW_HEIGHT,
  });
  const tab = readerWindow.tabs?.find((candidate) => candidate.id) || null;
  if (!tab?.id) throw new Error("Could not open the dedicated reader window.");
  return { tab, closeWhenDone: true };
}

async function ensureRefreshReaderWindow() {
  if (refreshReaderWindow?.windowId) {
    const existing = await chrome.windows.get(refreshReaderWindow.windowId).catch(() => null);
    if (existing) return refreshReaderWindow;
    refreshReaderWindow = null;
  }

  if (!refreshReaderWindowPromise) {
    // Keep a placeholder alive so one fast worker cannot close the shared window before another opens its tab.
    refreshReaderWindowPromise = chrome.windows
      .create({
        url: "about:blank",
        type: "normal",
        focused: false,
        width: READER_WINDOW_WIDTH,
        height: READER_WINDOW_HEIGHT,
      })
      .then((readerWindow) => {
        const placeholderTab = readerWindow.tabs?.find((candidate) => candidate.id) || null;
        if (!readerWindow.id || !placeholderTab?.id) {
          throw new Error("Could not open the background reader window.");
        }
        refreshReaderWindow = {
          windowId: readerWindow.id,
          placeholderTabId: placeholderTab.id,
          tabIds: new Set(),
        };
        return refreshReaderWindow;
      })
      .finally(() => {
        refreshReaderWindowPromise = null;
      });
  }

  return refreshReaderWindowPromise;
}

async function createRefreshReaderTab(venue) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const readerWindow = await ensureRefreshReaderWindow();
    try {
      const tab = await chrome.tabs.create({
        windowId: readerWindow.windowId,
        url: venue.startUrl,
        active: Boolean(venue.preferActiveReaderTab),
      });
      if (!tab?.id) throw new Error("Could not open a venue reader tab.");
      readerWindow.tabIds.add(tab.id);
      return tab;
    } catch (error) {
      const existing = await chrome.windows.get(readerWindow.windowId).catch(() => null);
      if (existing || attempt === 1) throw error;
      if (refreshReaderWindow?.windowId === readerWindow.windowId) refreshReaderWindow = null;
    }
  }
  throw new Error("Could not open a venue reader tab.");
}

export async function releaseRefreshReaderWindow() {
  const readerWindow = refreshReaderWindow;
  refreshReaderWindow = null;
  refreshReaderWindowPromise = null;
  if (!readerWindow?.windowId) return;

  const pendingRefreshes = await loadPendingRefreshes();
  const hasPendingSetup = Object.values(pendingRefreshes).some((session) =>
    readerWindow.tabIds.has(Number(session?.tabId))
  );

  if (hasPendingSetup) {
    await closeTab(readerWindow.placeholderTabId);
    return;
  }

  await chrome.windows.remove(readerWindow.windowId).catch(() => null);
}

export async function tabForVenue(venue) {
  if (venue.scanMode === "deep") return createDeepReaderWindow(venue);
  const tab = await createRefreshReaderTab(venue);
  return { tab, closeWhenDone: true };
}

export async function activateTab(tabId) {
  try {
    await chrome.tabs.update(tabId, { active: true });
  } catch {
    // A closed reader tab cannot be retried.
  }
}

export async function focusTab(tabId) {
  try {
    const tab = await chrome.tabs.get(Number(tabId));
    if (tab?.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
  } catch {
    // The user may have closed the window before the fallback could focus it.
  }

  try {
    await chrome.tabs.update(tabId, { active: true });
  } catch {
    // The user may have closed the tab before the fallback could focus it.
  }
}

export async function closeTab(tabId) {
  refreshReaderWindow?.tabIds.delete(Number(tabId));
  try {
    await chrome.tabs.remove(tabId);
  } catch {
    // A closed tab after a successful read is fine; the payload is already saved.
  }
}

// Previously the chrome.tabs.onRemoved/chrome.windows.onRemoved listeners in
// background.js mutated refreshReaderWindow directly. That state is now
// module-private, so those listeners call these instead.
export function forgetReaderTab(tabId) {
  refreshReaderWindow?.tabIds.delete(Number(tabId));
}

export function forgetReaderWindow(windowId) {
  if (refreshReaderWindow?.windowId === windowId) refreshReaderWindow = null;
}
