(() => {
  if (globalThis.__availabilityReaderBridgeInstalled) return;
  globalThis.__availabilityReaderBridgeInstalled = true;

  const READ_MESSAGE = "AVAILABILITY_READ_CURRENT_PAGE";

  const normalizeWhitespace = (value) => (value || "").replace(/\s+/g, " ").trim();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitUntil = async (predicate, timeoutMs, intervalMs = 150) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return true;
      await wait(intervalMs);
    }
    return predicate();
  };

  const manualSetupReason = () => {
    const bodyText = normalizeWhitespace(document.body?.innerText || "").toLowerCase();
    if (bodyText.includes("performing security verification") || bodyText.includes("cloudflare")) {
      return "Manual setup needed: security verification is still visible.";
    }
    if (bodyText.includes("waiver") || bodyText.includes("conditions")) {
      return "Manual setup needed: accept the waiver/conditions in the opened page first.";
    }
    if (bodyText.includes("log in") || bodyText.includes("login") || bodyText.includes("sign in")) {
      return "Manual setup needed: log in on the opened page first.";
    }
    return "Manual setup needed: the Playbypoint schedule widget is not visible yet.";
  };

  const providerFor = (providerId) => globalThis.AvailabilityProviders?.[providerId] || null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== READ_MESSAGE) return false;

    (async () => {
      const provider = providerFor(message.providerId);
      if (!provider) throw new Error(`Reader provider is not loaded: ${message.providerId}`);

      const readinessTimeoutMs = Number(message.readinessTimeoutMs || 0);
      if (readinessTimeoutMs > 0 && !provider.canRead()) {
        await waitUntil(() => provider.canRead(), readinessTimeoutMs);
      }

      if (!provider.canRead()) {
        sendResponse({ ok: false, manualSetupRequired: true, error: manualSetupReason() });
        return;
      }

      const payload = await provider.readAvailability(message.venue || {});
      sendResponse({ ok: true, payload });
    })().catch((error) => {
      sendResponse({ ok: false, error: error?.message || String(error) });
    });

    return true;
  });
})();
