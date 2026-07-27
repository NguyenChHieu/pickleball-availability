const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const bridgeSource = fs.readFileSync(
  path.join(__dirname, "..", "sharePageBridge.js"),
  "utf8"
);

function installFor(url) {
  const listeners = [];
  const location = new URL(url);
  const window = {
    location,
    addEventListener(type, listener) {
      listeners.push({ type, listener });
    },
    postMessage() {},
  };
  window.window = window;

  const context = {
    chrome: { runtime: { sendMessage: async () => ({ ok: true }) } },
    clearTimeout,
    console,
    Date,
    Promise,
    setTimeout,
    window,
  };
  vm.createContext(context);
  vm.runInContext(bridgeSource, context);
  return { installed: Boolean(context.__pbbSharePageBridgeInstalled), listeners };
}

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
