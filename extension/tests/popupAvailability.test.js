const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const popupHtml = fs.readFileSync(path.join(__dirname, "..", "popup.html"), "utf8");
const popupSource = fs.readFileSync(path.join(__dirname, "..", "popup.js"), "utf8")
  .replace(/^import .*;\s*$/m, "")
  .replace(/init\(\)\.catch\([\s\S]*$/, "");

test("View Availability remains visible and opens shared cache without a local payload", async () => {
  assert.match(popupHtml, /<div id="actions" class="actions">/);
  assert.match(popupHtml, /id="copyShareLinkButton"[^>]*hidden/);

  const nodes = new Map();
  const opened = [];
  const context = vm.createContext({
    AvailabilityRegistry: {},
    URL,
    chrome: {
      runtime: {
        openOptionsPage() {},
        async sendMessage() { return { ok: false, error: "Selection failed" }; },
      },
      storage: { local: { async get() {
        return { backendSyncConfig: {
          shareUrlBase: "https://pickleball-availability-tau.vercel.app",
          shareToken: "test-share",
        } };
      } } },
      tabs: { async create({ url }) { opened.push(url); } },
    },
    document: { querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, {
        addEventListener() {},
        classList: { toggle() {} },
        hidden: false,
        textContent: "",
      });
      return nodes.get(selector);
    } },
  });
  vm.runInContext(popupSource, context);
  vm.runInContext('selectedVenueId = "broadway"; syncActions();', context);

  assert.equal(nodes.get("#actions").hidden, false);
  assert.equal(nodes.get("#copyShareLinkButton").hidden, true);
  await context.viewAvailability();
  assert.deepEqual(opened, ["https://pickleball-availability-tau.vercel.app/s/test-share/broadway"]);

  vm.runInContext('latestPayload = { venue_id: "broadway" }; latestSyncStatus = { ok: true }; syncActions();', context);
  assert.equal(nodes.get("#copyShareLinkButton").hidden, false);
  vm.runInContext('selectedVenueId = "propickle"; syncActions();', context);
  assert.equal(nodes.get("#copyShareLinkButton").hidden, true);
  await assert.rejects(context.shareLink(), /Sync to the web app first/);

  vm.runInContext('selectedVenueId = "broadway"; syncActions();', context);
  await assert.rejects(context.selectVenue("propickle"), /Selection failed/);
  assert.equal(nodes.get("#venueSelect").value, "broadway");
  assert.equal(nodes.get("#copyShareLinkButton").hidden, false);
  assert.equal(nodes.get("#copyShareLinkButton").disabled, false);
});
