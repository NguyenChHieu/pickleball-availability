(() => {
  if (globalThis.__pbbSharePageBridgeInstalled) return;
  globalThis.__pbbSharePageBridgeInstalled = true;

  const PAGE_SOURCE = "pbb-share-page";
  const EXTENSION_SOURCE = "pbb-extension";
  const REQUEST_TYPE = "PBB_REFRESH_VENUE_REQUEST";
  const STATUS_TYPE = "PBB_REFRESH_VENUE_STATUS";
  const START_REFRESH_JOB = "AVAILABILITY_START_REFRESH_JOB";
  const GET_REFRESH_JOB = "AVAILABILITY_GET_REFRESH_JOB";
  const GET_REFRESH_HISTORY = "AVAILABILITY_GET_REFRESH_HISTORY";
  const OPEN_SETUP_WINDOW = "AVAILABILITY_OPEN_SETUP_WINDOW";
  const DASHBOARD_PAGE_SOURCE = "pbb-dashboard";
  const DASHBOARD_REQUEST_TYPE = "PBB_DASHBOARD_BRIDGE_REQUEST";
  const DASHBOARD_RESPONSE_TYPE = "PBB_DASHBOARD_BRIDGE_RESPONSE";
  const ACTIVE_STATUSES = new Set(["queued", "running"]);
  const POLL_INTERVAL_MS = 1200;
  const POLL_TIMEOUT_MS = 8 * 60 * 1000;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function postStatus(requestId, payload) {
    window.postMessage(
      {
        source: EXTENSION_SOURCE,
        type: STATUS_TYPE,
        requestId,
        ...payload,
      },
      window.location.origin
    );
  }

  function postDashboardResponse(requestId, payload) {
    window.postMessage(
      {
        source: EXTENSION_SOURCE,
        type: DASHBOARD_RESPONSE_TYPE,
        requestId,
        ...payload,
      },
      window.location.origin
    );
  }

  async function runtimeMessage(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || "The extension could not complete this request.");
    return response;
  }

  function safeVenueIds(value) {
    return Array.isArray(value)
      ? value.filter(
          (venueId, index) => typeof venueId === "string" && venueId && value.indexOf(venueId) === index
        )
      : [];
  }

  async function handleDashboardAction(action, payload = {}) {
    if (action === "ping") return { installed: true };

    if (action === "getState") {
      const [jobResponse, historyResponse] = await Promise.all([
        runtimeMessage({ type: GET_REFRESH_JOB }),
        runtimeMessage({ type: GET_REFRESH_HISTORY }),
      ]);
      return {
        job: jobResponse.job || null,
        pendingSetupVenueIds: jobResponse.pendingSetupVenueIds || [],
        history: historyResponse.history || [],
      };
    }

    if (action === "startRefresh") {
      const venueIds = safeVenueIds(payload.venueIds);
      if (!venueIds.length) throw new Error("Select at least one venue to refresh.");
      const scanMode = payload.scanMode === "cache-first" ? "cache-first" : "fast";
      const label = typeof payload.label === "string" ? payload.label.slice(0, 80) : "Dashboard refresh";
      const source = payload.source === "stale" ? "stale" : "selected";
      const response = await runtimeMessage({
        type: START_REFRESH_JOB,
        venueIds,
        scanMode,
        label,
        source,
      });
      return {
        job: response.job || null,
        alreadyRunning: Boolean(response.alreadyRunning),
      };
    }

    if (action === "openSetup") {
      const venueId = typeof payload.venueId === "string" ? payload.venueId : "";
      if (!venueId) throw new Error("Missing venue setup target.");
      await runtimeMessage({ type: OPEN_SETUP_WINDOW, venueId });
      return { opened: true };
    }

    throw new Error("Unknown dashboard extension action.");
  }

  function isActiveJob(job) {
    return ACTIVE_STATUSES.has(job?.status);
  }

  function resultForVenue(job, venueId) {
    return (Array.isArray(job?.results) ? job.results : []).find((result) => result.venueId === venueId) || null;
  }

  function statusMessage(job, venueId) {
    const result = resultForVenue(job, venueId);
    if (result?.status === "success") {
      if (result.syncOk === false) {
        return result.syncMessage || "Read saved in the extension, but web app sync failed.";
      }
      const days = Number(result.dayCount || 0);
      return `Updated ${days} day${days === 1 ? "" : "s"}.`;
    }
    if (result?.status === "setup_required") {
      return result.message || "Finish setup in the opened booking tab.";
    }
    if (result?.status === "failed") {
      return result.message || "Refresh failed.";
    }
    if (job && !isActiveJob(job)) return "Refresh finished without updating this venue. Try again.";
    if (job?.currentVenueName) return `Refreshing ${job.currentVenueName}...`;
    return "Refreshing availability...";
  }

  async function pollJob(requestId, venueId) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      const response = await chrome.runtime.sendMessage({ type: GET_REFRESH_JOB });
      if (!response?.ok) throw new Error(response?.error || "Could not read refresh status.");

      const job = response.job;
      if (!isActiveJob(job)) {
        const result = resultForVenue(job, venueId);
        const phase = result?.status === "success" || result?.status === "setup_required" ? "done" : "error";
        postStatus(requestId, {
          phase,
          jobStatus: job?.status || "unknown",
          result,
          message: statusMessage(job, venueId),
        });
        return;
      }

      postStatus(requestId, {
        phase: "running",
        jobStatus: job.status,
        message: statusMessage(job, venueId),
      });
      await wait(POLL_INTERVAL_MS);
    }

    throw new Error("Refresh is taking longer than expected. Check the extension popup for live status.");
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;

    const message = event.data;
    if (message?.source !== PAGE_SOURCE || message.type !== REQUEST_TYPE) return;

    const requestId = typeof message.requestId === "string" ? message.requestId : "";
    const venueId = typeof message.venueId === "string" ? message.venueId : "";
    if (!requestId || !venueId) return;

    (async () => {
      postStatus(requestId, { phase: "queued", message: "Starting venue refresh..." });
      const response = await chrome.runtime.sendMessage({
        type: START_REFRESH_JOB,
        venueIds: [venueId],
        scanMode: "fast",
        label: "Refresh selected",
        source: "selected",
      });

      if (!response?.ok) throw new Error(response?.error || "Could not start venue refresh.");
      const jobVenueIds = Array.isArray(response.job?.venueIds) ? response.job.venueIds : [];
      if (response.alreadyRunning && !jobVenueIds.includes(venueId)) {
        throw new Error("Another venue refresh is already running. Try again when it finishes.");
      }

      postStatus(requestId, {
        phase: "running",
        alreadyRunning: Boolean(response.alreadyRunning),
        jobStatus: response.job?.status || "queued",
        message: response.alreadyRunning ? "A refresh is already running..." : "Refreshing availability...",
      });
      await pollJob(requestId, venueId);
    })().catch((error) => {
      postStatus(requestId, {
        phase: "error",
        message: error?.message || String(error),
      });
    });
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;

    const message = event.data;
    if (message?.source !== DASHBOARD_PAGE_SOURCE || message.type !== DASHBOARD_REQUEST_TYPE) return;

    const requestId = typeof message.requestId === "string" ? message.requestId : "";
    const action = typeof message.action === "string" ? message.action : "";
    if (!requestId || !action) return;

    handleDashboardAction(action, message.payload)
      .then((payload) => postDashboardResponse(requestId, { ok: true, payload }))
      .catch((error) => {
        postDashboardResponse(requestId, {
          ok: false,
          error: error?.message || String(error),
        });
      });
  });
})();
