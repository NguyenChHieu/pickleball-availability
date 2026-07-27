const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const optionsSource = fs.readFileSync(path.join(__dirname, "..", "options.js"), "utf8");

function optionsHarness({ response = { status: 200, body: { attempt_id: "attempt_123", started_at: "2026-07-27T00:00:00.000Z" } } } = {}) {
  const nodes = new Map();
  const saved = [];
  const requests = [];
  const makeNode = (id) => {
    const node = {
      checked: false,
      disabled: false,
      value: "",
      textContent: "",
      addEventListener(type, handler) {
        node[`${type}Handler`] = handler;
      },
    };
    nodes.set(`#${id}`, node);
    return node;
  };
  for (const id of ["enabled", "backendUrl", "syncToken", "shareUrlBase", "shareToken", "saveButton", "status"]) {
    makeNode(id);
  }

  const context = {
    AbortController,
    URL,
    chrome: {
      storage: {
        local: {
          async get() {
            return {};
          },
          async set(value) {
            saved.push(value);
          },
        },
      },
    },
    clearTimeout,
    document: {
      querySelector(selector) {
        return nodes.get(selector);
      },
    },
    async fetch(url, init) {
      requests.push({ url, init });
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        async json() {
          return response.body;
        },
      };
    },
    setTimeout,
  };
  vm.createContext(context);
  vm.runInContext(optionsSource, context);
  return { nodes, requests, saved };
}

async function save(harness) {
  await harness.nodes.get("#saveButton").clickHandler();
}

test("saving enabled sync verifies the URL and token", async () => {
  const harness = optionsHarness();
  harness.nodes.get("#enabled").checked = true;
  harness.nodes.get("#backendUrl").value = "https://pickleball-availability-preview-henryngs-projects.vercel.app";
  harness.nodes.get("#syncToken").value = "test-secret";
  harness.nodes.get("#shareUrlBase").value = "https://pickleball-availability-preview-henryngs-projects.vercel.app";
  await save(harness);

  assert.equal(harness.saved.length, 1);
  assert.equal(harness.requests.length, 1);
  assert.match(harness.requests[0].url, /api\/availability\/propickle\/refresh-attempt$/);
  assert.equal(harness.requests[0].init.headers["x-sync-token"], "test-secret");
  assert.equal(harness.nodes.get("#status").textContent, "Saved. Sync connection verified.");
});

test("a rejected token is reported without discarding settings", async () => {
  const harness = optionsHarness({ response: { status: 401, body: {} } });
  harness.nodes.get("#enabled").checked = true;
  harness.nodes.get("#backendUrl").value = "https://pickleball-availability.vercel.app";
  harness.nodes.get("#shareUrlBase").value = "https://pickleball-availability.vercel.app";
  await save(harness);

  assert.equal(harness.saved.length, 1);
  assert.equal(harness.nodes.get("#status").textContent, "Saved, but the sync token was rejected.");
});

test("repeated clicks do not start overlapping connection checks", async () => {
  const harness = optionsHarness();
  harness.nodes.get("#enabled").checked = true;
  harness.nodes.get("#backendUrl").value = "https://pickleball-availability.vercel.app";
  harness.nodes.get("#shareUrlBase").value = "https://pickleball-availability.vercel.app";

  const click = harness.nodes.get("#saveButton").clickHandler;
  await Promise.all([click(), click()]);

  assert.equal(harness.saved.length, 1);
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.nodes.get("#saveButton").disabled, false);
});

test("insecure remote URLs are rejected before storage or network access", async () => {
  const harness = optionsHarness();
  harness.nodes.get("#enabled").checked = true;
  harness.nodes.get("#backendUrl").value = "http://example.com";
  harness.nodes.get("#shareUrlBase").value = "http://example.com";
  await save(harness);

  assert.equal(harness.saved.length, 0);
  assert.equal(harness.requests.length, 0);
  assert.equal(
    harness.nodes.get("#status").textContent,
    "Use this project's Vercel App URL, or localhost for development."
  );
});

test("booking-site URLs cannot receive the web sync token", async () => {
  const harness = optionsHarness();
  harness.nodes.get("#enabled").checked = true;
  harness.nodes.get("#backendUrl").value = "https://book.propickle.com.au";
  harness.nodes.get("#syncToken").value = "must-not-leave";
  harness.nodes.get("#shareUrlBase").value = "https://pickleball-availability.vercel.app";
  await save(harness);

  assert.equal(harness.saved.length, 0);
  assert.equal(harness.requests.length, 0);
});
