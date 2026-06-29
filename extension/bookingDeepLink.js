(() => {
  if (globalThis.__bookingDeepLinkInstalled) return;
  globalThis.__bookingDeepLinkInstalled = true;

  const providerId = "playbypoint-bookbox";
  const hashParam = "pbb_date";
  const readinessTimeoutMs = 10000;

  let activeSelection = "";
  let selectionInFlight = "";

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitUntil = async (predicate, timeoutMs, intervalMs = 150) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return true;
      await wait(intervalMs);
    }
    return predicate();
  };

  const targetDateFromHash = () => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return "";
    return new URLSearchParams(hash).get(hashParam) || "";
  };

  const provider = () => globalThis.AvailabilityProviders?.[providerId] || null;

  async function selectLinkedDate() {
    const targetDate = targetDateFromHash();
    if (!targetDate || targetDate === activeSelection || targetDate === selectionInFlight) return;

    selectionInFlight = targetDate;
    try {
      const reader = provider();
      if (!reader?.selectDate) return;
      if (reader.setupRequired?.()) return;

      await waitUntil(() => reader.setupRequired?.() || reader.canRead?.(), readinessTimeoutMs);
      if (reader.setupRequired?.() || !reader.canRead?.()) return;

      if (await reader.selectDate(targetDate)) activeSelection = targetDate;
    } catch (error) {
      console.warn(error);
    } finally {
      selectionInFlight = "";
    }
  }

  window.addEventListener("hashchange", () => {
    activeSelection = "";
    selectLinkedDate();
  });

  selectLinkedDate();
})();
