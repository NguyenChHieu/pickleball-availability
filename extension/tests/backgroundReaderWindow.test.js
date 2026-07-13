const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadBackground() {
  let nextWindowId = 1;
  let nextTabId = 10;
  const storage = {};
  const windows = new Map();
  const tabs = new Map();
  const calls = { createdWindows: 0, removedWindows: [] };

  function addTab(windowId, url, active) {
    const tab = { id: nextTabId++, windowId, url, active, status: "complete" };
    tabs.set(tab.id, tab);
    windows.get(windowId).tabIds.add(tab.id);
    return tab;
  }

  function removeTab(tabId) {
    const tab = tabs.get(Number(tabId));
    if (!tab) throw new Error("Unknown tab");
    tabs.delete(tab.id);
    const browserWindow = windows.get(tab.windowId);
    browserWindow?.tabIds.delete(tab.id);
    if (browserWindow && !browserWindow.tabIds.size) windows.delete(browserWindow.id);
  }

  const chrome = {
    storage: {
      local: {
        async get(key) {
          return { [key]: storage[key] };
        },
        async set(values) {
          Object.assign(storage, values);
        },
      },
    },
    windows: {
      async create(options) {
        calls.createdWindows += 1;
        const browserWindow = {
          id: nextWindowId++,
          focused: Boolean(options.focused),
          tabIds: new Set(),
        };
        windows.set(browserWindow.id, browserWindow);
        const tab = addTab(browserWindow.id, options.url, true);
        return { ...browserWindow, tabs: [tab] };
      },
      async get(windowId) {
        const browserWindow = windows.get(Number(windowId));
        if (!browserWindow) throw new Error("Unknown window");
        return browserWindow;
      },
      async update(windowId, updates) {
        const browserWindow = windows.get(Number(windowId));
        if (!browserWindow) throw new Error("Unknown window");
        Object.assign(browserWindow, updates);
        return browserWindow;
      },
      async remove(windowId) {
        const browserWindow = windows.get(Number(windowId));
        if (!browserWindow) throw new Error("Unknown window");
        for (const tabId of browserWindow.tabIds) tabs.delete(tabId);
        windows.delete(browserWindow.id);
        calls.removedWindows.push(browserWindow.id);
      },
      onRemoved: { addListener() {} },
    },
    tabs: {
      async create(options) {
        if (!windows.has(Number(options.windowId))) throw new Error("Unknown window");
        return addTab(Number(options.windowId), options.url, Boolean(options.active));
      },
      async get(tabId) {
        const tab = tabs.get(Number(tabId));
        if (!tab) throw new Error("Unknown tab");
        return tab;
      },
      async update(tabId, updates) {
        const tab = tabs.get(Number(tabId));
        if (!tab) throw new Error("Unknown tab");
        if (updates.active) {
          for (const candidate of tabs.values()) {
            if (candidate.windowId === tab.windowId) candidate.active = false;
          }
        }
        Object.assign(tab, updates);
        return tab;
      },
      async remove(tabId) {
        removeTab(tabId);
      },
      async query() {
        return [];
      },
      onUpdated: { addListener() {}, removeListener() {} },
      onRemoved: { addListener() {} },
    },
    scripting: { async executeScript() {} },
    runtime: { onMessage: { addListener() {} } },
  };

  const context = vm.createContext({
    AvailabilityRegistry: {},
    URL,
    chrome,
    clearInterval,
    clearTimeout,
    console,
    fetch,
    importScripts() {},
    setInterval,
    setTimeout,
  });
  const source = fs.readFileSync(path.resolve(__dirname, "../background.js"), "utf8");
  vm.runInContext(source, context, { filename: "background.js" });
  return { calls, context, storage, tabs, windows };
}

test("fast refresh tabs share one unfocused reader window and clean it up", async () => {
  const { calls, context, windows } = loadBackground();
  const venues = ["one", "two", "three"].map((id) => ({ id, startUrl: `https://example.com/${id}` }));

  const openedTabs = await Promise.all(venues.map((venue) => context.createRefreshReaderTab(venue)));

  assert.equal(calls.createdWindows, 1);
  assert.equal(new Set(openedTabs.map((tab) => tab.windowId)).size, 1);
  assert.equal(windows.get(openedTabs[0].windowId).focused, false);
  assert.ok(openedTabs.every((tab) => tab.active === false));

  await context.releaseRefreshReaderWindow();
  assert.equal(windows.size, 0);
  assert.deepEqual(calls.removedWindows, [openedTabs[0].windowId]);
});

test("setup tabs survive cleanup and open only after an explicit request", async () => {
  const { context, storage, tabs, windows } = loadBackground();
  const setupTab = await context.createRefreshReaderTab({ id: "setup", startUrl: "https://example.com/setup" });
  storage.pendingVenueRefreshes = {
    [setupTab.id]: {
      tabId: setupTab.id,
      venueId: "setup",
      startedAt: Date.now(),
      expiresAt: Date.now() + 60000,
    },
  };

  await context.releaseRefreshReaderWindow();

  assert.equal(windows.size, 1);
  assert.equal(tabs.size, 1);
  assert.equal(tabs.get(setupTab.id).active, false);
  assert.deepEqual(Array.from(await context.pendingSetupVenueIds()), ["setup"]);

  await context.openPendingSetupWindow("setup");
  assert.equal(windows.get(setupTab.windowId).focused, true);
  assert.equal(tabs.get(setupTab.id).active, true);
});
