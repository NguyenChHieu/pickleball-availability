const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const bridgeSource = fs.readFileSync(
  path.join(__dirname, "..", "sharePageBridge.js"),
  "utf8"
);
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));

function installFor(url) {
  const listeners = [];
  const runtimeMessages = [];
  const responses = [];
  const location = new URL(url);
  const window = {
    location,
    addEventListener(type, listener) {
      listeners.push({ type, listener });
    },
    postMessage(message) { responses.push(message); },
  };
  window.window = window;

  const context = {
    chrome: { runtime: { sendMessage: async (message) => {
      runtimeMessages.push(message);
      return { ok: true };
    } } },
    clearTimeout,
    console,
    Date,
    Promise,
    setTimeout,
    window,
  };
  vm.createContext(context);
  vm.runInContext(bridgeSource, context);
  return { installed: Boolean(context.__pbbSharePageBridgeInstalled), listeners, runtimeMessages, responses, window };
}

test("dashboard availability action delegates to the extension without exposing a token", async () => {
  const page = installFor("https://pickleball-availability-tau.vercel.app/app");
  for (const { type, listener } of page.listeners) {
    if (type !== "message") continue;
    listener({
      source: page.window,
      origin: page.window.location.origin,
      data: {
        source: "pbb-dashboard",
        type: "PBB_DASHBOARD_BRIDGE_REQUEST",
        requestId: "availability-test",
        action: "openAvailability",
        payload: { venueId: "broadway" },
      },
    });
  }
  await new Promise(setImmediate);
  assert.equal(page.runtimeMessages[0]?.type, "AVAILABILITY_OPEN_AVAILABILITY_PAGE");
  assert.equal(page.runtimeMessages[0]?.venueId, "broadway");
  assert.equal(page.responses.find((message) => message.requestId === "availability-test")?.ok, true);
  assert.doesNotMatch(JSON.stringify(page.responses), /shareToken|private-share/);
});

test("installs on this project's stable branch Preview alias", () => {
  const result = installFor(
    "https://pickleball-availability-git-codex-trus-c13fa0-henryngs-projects.vercel.app/app"
  );
  assert.equal(result.installed, true);
  assert.equal(result.listeners.length, 2);
});

test("installs on an exact Preview deployment alias", () => {
  const result = installFor(
    "https://pickleball-availability-rit90ymtt-henryngs-projects.vercel.app/s/dev-share/propickle"
  );
  assert.equal(result.installed, true);
});

test("installs on production and local development", () => {
  assert.equal(installFor("https://pickleball-availability.vercel.app/app").installed, true);
  assert.equal(installFor("http://localhost:3007/app").installed, true);
});

test("does not install on unrelated or lookalike Vercel deployments", () => {
  assert.equal(installFor("https://unrelated.vercel.app/app").installed, false);
  assert.equal(
    installFor("https://pickleball-availability-preview-attacker-projects.vercel.app/app").installed,
    false
  );
});

test("injects dashboard bridge before the app sends its startup ping", () => {
  const bridgeScript = manifest.content_scripts.find((script) =>
    Array.isArray(script.js) && script.js.includes("sharePageBridge.js")
  );

  assert.ok(bridgeScript);
  assert.equal(bridgeScript.run_at, "document_start");
  assert.ok(bridgeScript.matches.includes("https://*.vercel.app/app*"));
  assert.ok(bridgeScript.matches.includes("http://localhost:3007/app*"));
});
