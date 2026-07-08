"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type RefreshPhase = "idle" | "queued" | "running" | "done" | "error";

type RefreshStatusMessage = {
  source?: string;
  type?: string;
  requestId?: string;
  phase?: RefreshPhase;
  message?: string;
  result?: {
    status?: string;
    pendingRefresh?: boolean;
    message?: string;
    syncOk?: boolean;
  } | null;
};

type ShareRefreshButtonProps = Readonly<{
  venueId: string;
  variant?: "desktop" | "mobile" | "sticky";
  children?: ReactNode;
}>;

const PAGE_SOURCE = "pbb-share-page";
const EXTENSION_SOURCE = "pbb-extension";
const REQUEST_TYPE = "PBB_REFRESH_VENUE_REQUEST";
const STATUS_TYPE = "PBB_REFRESH_VENUE_STATUS";
const EXTENSION_TIMEOUT_MS = 1800;

function makeRequestId() {
  return `pbb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function statusLabel(phase: RefreshPhase, message: string) {
  if (phase === "queued") return "Starting...";
  if (phase === "running") return "Refreshing...";
  if (phase === "done") return message || "Updated";
  if (phase === "error") return "Could not refresh";
  return "";
}

export function ShareRefreshButton({
  venueId,
  variant = "desktop",
  children,
}: ShareRefreshButtonProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<RefreshPhase>("idle");
  const [message, setMessage] = useState("");
  const requestIdRef = useRef("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isBusy = phase === "queued" || phase === "running";
  const buttonLabel = useMemo(() => {
    if (variant === "mobile") return children || "Refresh";
    if (isBusy) return "Refreshing";
    if (phase === "done") return "Updated";
    if (phase === "error") return "Retry refresh";
    return children || "Refresh";
  }, [children, isBusy, phase, variant]);

  useEffect(() => {
    function clearTimers() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (doneTimeoutRef.current) clearTimeout(doneTimeoutRef.current);
      timeoutRef.current = null;
      doneTimeoutRef.current = null;
    }

    function handleMessage(event: MessageEvent<RefreshStatusMessage>) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data;
      if (
        data?.source !== EXTENSION_SOURCE ||
        data.type !== STATUS_TYPE ||
        data.requestId !== requestIdRef.current
      ) {
        return;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const nextPhase = data.phase || "running";
      const nextMessage = data.message || statusLabel(nextPhase, "");
      setPhase(nextPhase);
      setMessage(nextMessage);

      if (nextPhase === "done") {
        const shouldReload = data.result?.status === "success" && data.result?.syncOk !== false;
        doneTimeoutRef.current = setTimeout(() => {
          if (shouldReload) router.refresh();
        }, 350);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => {
      clearTimers();
      window.removeEventListener("message", handleMessage);
    };
  }, [router]);

  function refreshAvailability() {
    if (isBusy) return;

    const requestId = makeRequestId();
    requestIdRef.current = requestId;
    setPhase("queued");
    setMessage("Asking the extension to refresh this venue...");

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setPhase("error");
      setMessage("Reload the unpacked extension, then try again from this share page.");
    }, EXTENSION_TIMEOUT_MS);

    window.postMessage(
      {
        source: PAGE_SOURCE,
        type: REQUEST_TYPE,
        requestId,
        venueId,
      },
      window.location.origin
    );
  }

  return (
    <div className={`stitch-refresh-control stitch-refresh-control--${variant}`}>
      <button
        className="stitch-refresh-button"
        disabled={isBusy}
        type="button"
        onClick={refreshAvailability}
        title={message || "Ask the browser extension to re-read this venue and update the cached share page."}
      >
        {buttonLabel}
      </button>
      <span className="stitch-refresh-status" aria-live="polite">
        {message || statusLabel(phase, message)}
      </span>
    </div>
  );
}
