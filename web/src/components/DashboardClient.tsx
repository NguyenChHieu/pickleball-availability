"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type { DashboardVenue } from "@/server/dashboard";
import styles from "./DashboardClient.module.css";

type RefreshResult = Readonly<{
  venueId?: string;
  venueName?: string;
  status?: "success" | "failed" | "setup_required";
  message?: string;
  dayCount?: number;
  syncOk?: boolean;
  syncMessage?: string;
  cacheHit?: boolean;
  durationMs?: number;
}>;

type RefreshJob = Readonly<{
  id?: string;
  label?: string;
  scanMode?: string;
  status?: string;
  total?: number;
  completed?: number;
  parallelLimit?: number;
  currentVenueName?: string;
  startedAt?: string;
  finishedAt?: string;
  results?: readonly RefreshResult[];
  error?: string;
}>;

type BridgeState = Readonly<{
  job?: RefreshJob | null;
  pendingSetupVenueIds?: readonly string[];
  history?: readonly RefreshJob[];
}>;

type BridgeResponse = Readonly<{
  source?: string;
  type?: string;
  requestId?: string;
  ok?: boolean;
  payload?: BridgeState & { installed?: boolean; alreadyRunning?: boolean };
  error?: string;
}>;

type DashboardClientProps = Readonly<{
  venues: readonly DashboardVenue[];
}>;

type BridgeConnection = "checking" | "connected" | "disconnected";

const PAGE_SOURCE = "pbb-dashboard";
const EXTENSION_SOURCE = "pbb-extension";
const REQUEST_TYPE = "PBB_DASHBOARD_BRIDGE_REQUEST";
const RESPONSE_TYPE = "PBB_DASHBOARD_BRIDGE_RESPONSE";
const SELECTED_STORAGE_KEY = "pbb-dashboard-selected-venues-v1";
const ACTIVE_JOB_STATUSES = new Set(["queued", "running"]);
const DEFAULT_VISIBLE_COUNT = 3;

function isActiveJob(job?: RefreshJob | null) {
  return ACTIVE_JOB_STATUSES.has(job?.status || "");
}

function requestId() {
  return `dashboard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function bridgeRequest(action: string, payload: Record<string, unknown> = {}, timeoutMs = 2200) {
  return new Promise<BridgeResponse["payload"]>((resolve, reject) => {
    const id = requestId();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      reject(new Error("Browser extension not detected on this page."));
    }, timeoutMs);

    function handleMessage(event: MessageEvent<BridgeResponse>) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const response = event.data;
      if (
        response?.source !== EXTENSION_SOURCE ||
        response.type !== RESPONSE_TYPE ||
        response.requestId !== id
      ) {
        return;
      }

      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
      if (!response.ok) {
        reject(new Error(response.error || "The extension could not complete this request."));
        return;
      }
      resolve(response.payload || {});
    }

    window.addEventListener("message", handleMessage);
    window.postMessage(
      {
        source: PAGE_SOURCE,
        type: REQUEST_TYPE,
        requestId: id,
        action,
        payload,
      },
      window.location.origin
    );
  });
}

function resultTone(status?: string) {
  if (status === "success") return "success";
  if (status === "setup_required") return "setup";
  return "failed";
}

function durationLabel(durationMs?: number) {
  const value = Number(durationMs || 0);
  if (!value) return "";
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}s`;
}

function elapsedLabel(startedAt?: string, finishedAt?: string, now = Date.now()) {
  const start = new Date(startedAt || "").getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : now;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "";
  return durationLabel(Math.max(0, end - start));
}

function resultMessage(result: RefreshResult) {
  if (result.status === "success") {
    const days = Number(result.dayCount || 0);
    if (result.syncOk === false) return result.syncMessage || "Read succeeded, web sync failed.";
    return `${days} day${days === 1 ? "" : "s"} saved${result.cacheHit ? " from cache" : ""}.`;
  }
  if (result.status === "setup_required") return result.message || "Finish setup in the opened tab.";
  return result.message || "Refresh failed.";
}

function historySummary(job: RefreshJob) {
  const results = job.results || [];
  const success = results.filter((result) => result.status === "success").length;
  const issues = results.length - success;
  if (job.status === "failed") return "Failed";
  return `${success} succeeded${issues ? `, ${issues} need attention` : ""}`;
}

export function DashboardClient({ venues }: DashboardClientProps) {
  const router = useRouter();
  const [connection, setConnection] = useState<BridgeConnection>("checking");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedIdsLoaded, setSelectedIdsLoaded] = useState(false);
  const [job, setJob] = useState<RefreshJob | null>(null);
  const [history, setHistory] = useState<readonly RefreshJob[]>([]);
  const [pendingSetupVenueIds, setPendingSetupVenueIds] = useState<readonly string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState(0);
  const previousJobRef = useRef<{ id?: string; status?: string }>({});
  const venueListRef = useRef<HTMLDivElement>(null);

  const active = isActiveJob(job);
  const staleIds = useMemo(
    () => venues.filter((venue) => venue.state !== "fresh").map((venue) => venue.id),
    [venues]
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(SELECTED_STORAGE_KEY) || "[]");
        const validIds = Array.isArray(stored)
          ? stored.filter((id): id is string => typeof id === "string" && venues.some((venue) => venue.id === id))
          : [];
        setSelectedIds(new Set(validIds));
      } catch {
        setSelectedIds(new Set());
      }
      setSelectedIdsLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [venues]);

  useEffect(() => {
    if (!selectedIdsLoaded) return;
    window.localStorage.setItem(SELECTED_STORAGE_KEY, JSON.stringify([...selectedIds]));
  }, [selectedIds, selectedIdsLoaded]);

  const syncBridgeState = useCallback(async () => {
    try {
      const state = await bridgeRequest("getState", {}, 3000);
      setConnection("connected");
      setJob(state?.job || null);
      setHistory(state?.history || []);
      setPendingSetupVenueIds(state?.pendingSetupVenueIds || []);
      return state;
    } catch (error) {
      setConnection("disconnected");
      setNotice(error instanceof Error ? error.message : String(error));
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    bridgeRequest("ping", {}, 1200)
      .then(() => {
        if (cancelled) return;
        setConnection("connected");
        return syncBridgeState();
      })
      .catch(() => {
        if (!cancelled) setConnection("disconnected");
      });
    return () => {
      cancelled = true;
    };
  }, [syncBridgeState]);

  useEffect(() => {
    if (connection !== "connected") return;
    const interval = window.setInterval(syncBridgeState, active ? 1200 : 7000);
    return () => window.clearInterval(interval);
  }, [active, connection, syncBridgeState]);

  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setClock(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [active]);

  useEffect(() => {
    const previous = previousJobRef.current;
    const finishedSameJob =
      previous.id &&
      previous.id === job?.id &&
      ACTIVE_JOB_STATUSES.has(previous.status || "") &&
      !isActiveJob(job);
    previousJobRef.current = { id: job?.id, status: job?.status };
    if (finishedSameJob) {
      setNotice(job?.status === "completed" ? "Availability cache updated." : "Refresh finished with issues.");
      router.refresh();
    }
  }, [job, router]);

  const orderedVenues = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return venues
      .filter((venue) => {
        if (!normalizedQuery) return true;
        return `${venue.name} ${venue.platform}`.toLowerCase().includes(normalizedQuery);
      })
      .sort((left, right) => {
        const selectedDifference = Number(selectedIds.has(left.id)) - Number(selectedIds.has(right.id));
        return selectedDifference || venues.indexOf(left) - venues.indexOf(right);
      });
  }, [query, selectedIds, venues]);

  const selectedVenueIds = [...selectedIds];

  useEffect(() => {
    if (venueListRef.current) venueListRef.current.scrollTop = 0;
  }, [query]);

  function toggleVenue(venueId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(venueId)) next.delete(venueId);
      else next.add(venueId);
      return next;
    });
  }

  async function startRefresh(
    venueIds: string[],
    scanMode: "fast" | "cache-first",
    label: string,
    source: "selected" | "stale"
  ) {
    if (!venueIds.length || active) return;
    setNotice("");
    try {
      const response = await bridgeRequest("startRefresh", { venueIds, scanMode, label, source }, 4000);
      setConnection("connected");
      setJob(response?.job || null);
      setNotice(response?.alreadyRunning ? "A refresh is already running." : `${label} started.`);
      await syncBridgeState();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      await syncBridgeState();
    }
  }

  async function openSetup(venueId: string) {
    try {
      await bridgeRequest("openSetup", { venueId }, 4000);
      setNotice("Opened the venue setup window.");
      await syncBridgeState();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  const progress = job?.total ? Math.min(100, Math.round(((job.completed || 0) / job.total) * 100)) : 0;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <span>Availability</span>
          <strong>Buddy</strong>
        </Link>
        <nav className={styles.nav} aria-label="Application">
          <Link className={styles.activeNav} href="/app" aria-current="page">Dashboard</Link>
          <a href="#venues">Venues</a>
          <Link href="/planner/new">Planner</Link>
          <Link href="/">Home</Link>
        </nav>
        <div
          className={styles.connection}
          data-state={connection}
          role="status"
          aria-live="polite"
          title={connection === "connected" ? "Extension connected" : "Cached results remain available without the extension bridge"}
        >
          <span aria-hidden="true" />
          <span className={styles.connectionLabel}>
            {connection === "connected" ? "Extension live" : connection === "checking" ? "Checking" : "Cached view"}
          </span>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.intro} aria-labelledby="dashboard-title">
          <p>{venues.length} venues tracked</p>
          <div>
            <h1 id="dashboard-title">Availability dashboard</h1>
            <Link href="/planner/new">Create group planner</Link>
          </div>
          <p>
            Browse the last saved results instantly. The extension only opens booking readers after you request a refresh.
          </p>
        </section>

        <section className={styles.controls} aria-label="Venue refresh controls">
          <label className={styles.search}>
            <span className="sr-only">Search venues</span>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              placeholder="Search venues or platforms"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={active || !staleIds.length || connection !== "connected"}
            onClick={() => startRefresh(staleIds, "cache-first", "Refresh stale", "stale")}
          >
            Refresh stale <span>{staleIds.length}</span>
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={active || !selectedVenueIds.length || connection !== "connected"}
            onClick={() => startRefresh(selectedVenueIds, "fast", "Refresh selected", "selected")}
          >
            {active ? "Refresh running" : `Refresh selected${selectedVenueIds.length ? ` (${selectedVenueIds.length})` : ""}`}
          </button>
        </section>

        {connection === "disconnected" ? (
          <aside className={styles.bridgeNotice} aria-live="polite">
            <strong>Cached results are still available.</strong>
            <span>Reload the unpacked extension, then reload this page to enable refresh controls.</span>
          </aside>
        ) : notice ? (
          <p className={styles.notice} aria-live="polite">{notice}</p>
        ) : null}

        <div className={styles.dashboardGrid}>
          <section className={styles.venueSection} id="venues" aria-labelledby="venue-list-title">
            <div className={styles.sectionHeading}>
              <div>
                <p>Saved results</p>
                <h2 id="venue-list-title">Choose venues to refresh</h2>
              </div>
              <span>{selectedIds.size} selected</span>
            </div>

            <div
              className={styles.venueList}
              ref={venueListRef}
              tabIndex={orderedVenues.length > DEFAULT_VISIBLE_COUNT ? 0 : undefined}
              aria-label="Venue results"
            >
              {orderedVenues.map((venue) => {
                const selected = selectedIds.has(venue.id);
                return (
                  <article
                    className={styles.venueCard}
                    data-selected={selected || undefined}
                    data-state={venue.state}
                    key={venue.id}
                    style={{ "--venue-accent": venue.accent } as CSSProperties}
                  >
                    <label className={styles.venueCheck}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleVenue(venue.id)}
                      />
                      <span aria-hidden="true" />
                      <span className="sr-only">Select {venue.name}</span>
                    </label>
                    <div className={styles.venueIdentity}>
                      <h3>{venue.name}</h3>
                      <p>{venue.platform}</p>
                    </div>
                    <div className={styles.venueStatus}>
                      <strong>{venue.freshnessLabel}</strong>
                      {venue.refreshMessage ? <span>{venue.refreshMessage}</span> : null}
                      <span>{venue.dayCount ? `${venue.dayCount} days · ${venue.totalOpenHours.toFixed(1)} open hrs` : "Refresh required"}</span>
                    </div>
                    <div className={styles.nextOpening}>
                      <strong>{venue.nextOpening}</strong>
                      <span>{venue.nextOpeningDetail}</span>
                    </div>
                    <a className={styles.bookingLink} href={venue.fallbackUrl} target="_blank" rel="noreferrer">
                      Booking page <span aria-hidden="true">↗</span>
                    </a>
                  </article>
                );
              })}
            </div>

            {!orderedVenues.length ? (
              <p className={styles.emptyState}>No venue or platform matches “{query}”.</p>
            ) : null}
          </section>

          <aside className={styles.activity} aria-labelledby="activity-title">
            <div className={styles.activityHeading}>
              <span aria-hidden="true" />
              <h2 id="activity-title">Live refresh activity</h2>
            </div>

            {active ? (
              <div className={styles.activeJob}>
                <div className={styles.pickleLoader} aria-hidden="true">
                  <span className={styles.paddle} />
                  <span className={styles.ball} />
                </div>
                <div className={styles.activeJobCopy}>
                  <p>{job?.label || "Refreshing availability"}</p>
                  <strong>{job?.completed || 0} of {job?.total || 0} venues complete</strong>
                  <span>{job?.parallelLimit && job.parallelLimit > 1 ? `${job.parallelLimit} readers in parallel` : job?.currentVenueName || "Starting reader"}</span>
                </div>
                <div className={styles.progressTrack} aria-label={`${progress}% complete`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                  <span style={{ width: `${progress}%` }} />
                </div>
                <small>
                  {elapsedLabel(
                    job?.startedAt,
                    undefined,
                    clock || new Date(job?.startedAt || "").getTime()
                  )} elapsed
                </small>
              </div>
            ) : (
              <div className={styles.idleActivity}>
                <div className={styles.pickleMark} aria-hidden="true">•••</div>
                <strong>{connection === "connected" ? "Ready when you are" : "Showing saved cache"}</strong>
                <p>{connection === "connected" ? "Select venues, then start a refresh." : "The extension bridge is not connected."}</p>
              </div>
            )}

            {job?.results?.length ? (
              <div className={styles.resultList} aria-live="polite">
                {job.results.map((result) => (
                  <div className={styles.resultRow} data-tone={resultTone(result.status)} key={result.venueId}>
                    <span aria-hidden="true" />
                    <div>
                      <strong>{result.venueName || result.venueId}</strong>
                      <p>{resultMessage(result)}</p>
                    </div>
                    <small>{durationLabel(result.durationMs)}</small>
                    {result.status === "setup_required" && pendingSetupVenueIds.includes(result.venueId || "") ? (
                      <button type="button" onClick={() => openSetup(result.venueId || "")}>Open setup</button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <section className={styles.historySection}>
              <button type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen((value) => !value)}>
                <span>Refresh history</span>
                <span>{history.length}</span>
                <span aria-hidden="true">{historyOpen ? "−" : "+"}</span>
              </button>
              {historyOpen ? (
                <div className={styles.historyList}>
                  {history.length ? history.slice(0, 5).map((entry) => (
                    <div key={entry.id || `${entry.startedAt}-${entry.label}`}>
                      <strong>{entry.label || "Refresh"}</strong>
                      <span>{historySummary(entry)}</span>
                      <small>{elapsedLabel(entry.startedAt, entry.finishedAt)} total</small>
                    </div>
                  )) : <p>No completed refreshes on this device yet.</p>}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
