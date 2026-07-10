"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PlannerAvailabilityBlock,
  PlannerRecommendation,
  PublicPlannerEventView,
  PublicPlannerParticipant,
} from "@/server/plannerTypes";

type SavedPlannerIdentity = {
  participantId: string;
  displayName: string;
  editToken: string;
};

const SLOT_MINUTES = 30;

export function PlannerEventClient({ initialView }: Readonly<{ initialView: PublicPlannerEventView }>) {
  const [view, setView] = useState(initialView);
  const storageKey = `pbb-planner-${initialView.event.eventToken}`;
  const [displayName, setDisplayName] = useState("");
  const [selectedCells, setSelectedCells] = useState<Set<string>>(() => new Set());
  const [savedIdentity, setSavedIdentity] = useState<SavedPlannerIdentity | null>(null);
  const [dragMode, setDragMode] = useState<boolean | null>(null);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const dates = useMemo(() => dateRange(view.event.dateStart, view.event.dateEnd), [view.event]);
  const timeSlots = useMemo(
    () => timeRange(view.event.preferredStartTime, view.event.preferredEndTime),
    [view.event.preferredStartTime, view.event.preferredEndTime]
  );

  useEffect(() => {
    if (savedIdentity) return;
    const saved = readSavedIdentity(storageKey);
    if (!saved) return;
    const timeout = window.setTimeout(() => {
      setSavedIdentity(saved);
      setDisplayName(saved.displayName);
      setSelectedCells(initialSelectedCells(saved, view.participants));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [savedIdentity, storageKey, view.participants]);

  useEffect(() => {
    function stopDrag() {
      setDragMode(null);
    }
    window.addEventListener("pointerup", stopDrag);
    return () => window.removeEventListener("pointerup", stopDrag);
  }, []);

  function setCell(cellKey: string, selected: boolean) {
    setSelectedCells((current) => {
      const next = new Set(current);
      if (selected) next.add(cellKey);
      else next.delete(cellKey);
      return next;
    });
  }

  function handlePointerDown(cellKey: string) {
    const shouldSelect = !selectedCells.has(cellKey);
    setDragMode(shouldSelect);
    setCell(cellKey, shouldSelect);
  }

  function handlePointerEnter(cellKey: string) {
    if (dragMode === null) return;
    setCell(cellKey, dragMode);
  }

  async function handleSave() {
    setIsSaving(true);
    setStatus("");
    try {
      const response = await fetch(`/api/planner/events/${encodeURIComponent(view.event.eventToken)}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName,
          editToken: savedIdentity?.editToken,
          availabilityBlocks: blocksFromCells(selectedCells),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save availability.");
      const identity = body.participant as SavedPlannerIdentity;
      window.localStorage.setItem(storageKey, JSON.stringify(identity));
      setSavedIdentity(identity);
      setDisplayName(identity.displayName);
      setView(body.view);
      setStatus("Saved. The recommendations below are updated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save availability.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="planner-shell">
      <header className="planner-event-header">
        <a href="/planner/new">New planner</a>
        <p className="planner-kicker">Secret event link</p>
        <h1>{view.event.name}</h1>
        <p>
          {formatDate(view.event.dateStart)} - {formatDate(view.event.dateEnd)} -{" "}
          {formatMinutes(parseTime(view.event.preferredStartTime))}-
          {formatMinutes(parseTime(view.event.preferredEndTime))} - {view.event.minimumDurationMinutes} min minimum
        </p>
      </header>

      <section className="planner-layout">
        <div className="planner-panel planner-panel--grid" aria-labelledby="planner-grid-title">
          <div className="planner-panel__header">
            <div>
              <h2 id="planner-grid-title">Your availability</h2>
              <p>Mark the times you could play. This only updates your own response.</p>
            </div>
            <label className="planner-name">
              <span>Name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name"
                maxLength={60}
              />
            </label>
          </div>

          <AvailabilityGrid
            dates={dates}
            selectedCells={selectedCells}
            timeSlots={timeSlots}
            onPointerDown={handlePointerDown}
            onPointerEnter={handlePointerEnter}
          />

          <div className="planner-actions">
            <button className="planner-primary" disabled={isSaving || !displayName.trim()} onClick={handleSave}>
              {isSaving ? "Saving..." : savedIdentity ? "Update my times" : "Save my times"}
            </button>
            {status ? <p className={status.startsWith("Saved") ? "planner-success" : "planner-error"}>{status}</p> : null}
          </div>
        </div>

        <aside className="planner-panel planner-panel--side" aria-label="Planner summary">
          <ParticipantsList participants={view.participants} />
          <VenueFreshness view={view} />
        </aside>
      </section>

      <section className="planner-panel planner-recommendations" aria-labelledby="planner-results-title">
        <div className="planner-panel__header">
          <div>
            <h2 id="planner-results-title">Best matches</h2>
            <p>Ranked from cached venue availability. Use the extension to refresh venues when the cache is stale.</p>
          </div>
        </div>
        {view.recommendations.length ? (
          <div className="planner-recommendation-list">
            {view.recommendations.map((recommendation) => (
              <RecommendationCard recommendation={recommendation} key={recommendation.id} />
            ))}
          </div>
        ) : (
          <div className="planner-empty">
            <h3>No matching slots yet.</h3>
            <p>Add participant availability, refresh venue caches from the extension, or loosen the minimum session length.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function AvailabilityGrid({
  dates,
  selectedCells,
  timeSlots,
  onPointerDown,
  onPointerEnter,
}: Readonly<{
  dates: string[];
  timeSlots: number[];
  selectedCells: Set<string>;
  onPointerDown: (cellKey: string) => void;
  onPointerEnter: (cellKey: string) => void;
}>) {
  return (
    <div className="planner-grid-wrap">
      <div
        className="planner-grid"
        style={{ gridTemplateColumns: `84px repeat(${dates.length}, minmax(88px, 1fr))` }}
      >
        <div className="planner-grid__corner">Time</div>
        {dates.map((date) => (
          <div className="planner-grid__day" key={date}>
            <span>{formatWeekday(date)}</span>
            <strong>{formatShortDate(date)}</strong>
          </div>
        ))}
        {timeSlots.map((minute) => (
          <Row
            dates={dates}
            key={minute}
            minute={minute}
            onPointerDown={onPointerDown}
            onPointerEnter={onPointerEnter}
            selectedCells={selectedCells}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  dates,
  minute,
  onPointerDown,
  onPointerEnter,
  selectedCells,
}: Readonly<{
  dates: string[];
  minute: number;
  selectedCells: Set<string>;
  onPointerDown: (cellKey: string) => void;
  onPointerEnter: (cellKey: string) => void;
}>) {
  return (
    <>
      <div className="planner-grid__time">{formatMinutes(minute)}</div>
      {dates.map((date) => {
        const cellKey = keyForCell(date, minute);
        const selected = selectedCells.has(cellKey);
        return (
          <button
            aria-label={`${selected ? "Remove" : "Add"} ${formatShortDate(date)} ${formatMinutes(minute)}`}
            aria-pressed={selected}
            className="planner-grid__cell"
            key={cellKey}
            onPointerDown={(event) => {
              event.preventDefault();
              onPointerDown(cellKey);
            }}
            onPointerEnter={() => onPointerEnter(cellKey)}
            type="button"
          />
        );
      })}
    </>
  );
}

function ParticipantsList({ participants }: Readonly<{ participants: PublicPlannerParticipant[] }>) {
  return (
    <section className="planner-side-section" aria-labelledby="planner-people-title">
      <h2 id="planner-people-title">People</h2>
      {participants.length ? (
        <ul className="planner-people">
          {participants.map((participant) => (
            <li key={participant.participantId}>
              <span>{participant.displayName}</span>
              <small>{participant.availabilityBlocks.length} block(s)</small>
            </li>
          ))}
        </ul>
      ) : (
        <p>No one has saved availability yet.</p>
      )}
    </section>
  );
}

function VenueFreshness({ view }: Readonly<{ view: PublicPlannerEventView }>) {
  return (
    <section className="planner-side-section" aria-labelledby="planner-cache-title">
      <h2 id="planner-cache-title">Venue cache</h2>
      <ul className="planner-cache-list">
        {view.venues.map((venue) => (
          <li key={venue.venueId}>
            <span>{venue.venueName}</span>
            <small>
              {venue.state === "ready"
                ? `${venue.isStale ? "stale" : "fresh"} - ${venue.freshnessLabel || "unknown read"}`
                : "no cached read"}
            </small>
          </li>
        ))}
      </ul>
      <p>Planner pages only read cached data. Refresh selected venues from the Chrome extension for fresher matches.</p>
    </section>
  );
}

function RecommendationCard({ recommendation }: Readonly<{ recommendation: PlannerRecommendation }>) {
  return (
    <article className="planner-recommendation">
      <div>
        <p>{formatDate(recommendation.date)}</p>
        <h3>
          {formatMinutes(recommendation.startMinute)}-{formatMinutes(recommendation.endMinute)}
        </h3>
      </div>
      <div>
        <strong>{recommendation.venueName}</strong>
        <span>
          {recommendation.availableParticipantCount} available -{" "}
          {recommendation.confidence === "same-court"
            ? `same court${recommendation.courtName ? ` (${recommendation.courtName})` : ""}`
            : "any court"}
        </span>
        <small>
          {recommendation.availableParticipantNames.join(", ")}
          {recommendation.freshnessLabel
            ? ` - ${recommendation.isStale ? "stale cache" : "last read"} ${recommendation.freshnessLabel}`
            : ""}
        </small>
      </div>
    </article>
  );
}

function readSavedIdentity(storageKey: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as SavedPlannerIdentity) : null;
  } catch {
    return null;
  }
}

function initialSelectedCells(saved: SavedPlannerIdentity, participants: PublicPlannerParticipant[]) {
  const participant = saved ? participants.find((item) => item.participantId === saved.participantId) : null;
  return participant ? cellsFromBlocks(participant.availabilityBlocks) : new Set<string>();
}

function parseTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

function timeRange(startTime: string, endTime: string) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const times: number[] = [];
  for (let minute = start; minute + SLOT_MINUTES <= end; minute += SLOT_MINUTES) {
    times.push(minute);
  }
  return times;
}

function dateRange(dateStart: string, dateEnd: string) {
  const dates: string[] = [];
  const start = new Date(`${dateStart}T00:00:00`);
  const end = new Date(`${dateEnd}T00:00:00`);
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(formatLocalIsoDate(cursor));
  }
  return dates;
}

function formatLocalIsoDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function keyForCell(date: string, minute: number) {
  return `${date}:${minute}`;
}

function cellsFromBlocks(blocks: PlannerAvailabilityBlock[]) {
  const cells = new Set<string>();
  for (const block of blocks) {
    for (let minute = block.startMinute; minute < block.endMinute; minute += SLOT_MINUTES) {
      cells.add(keyForCell(block.date, minute));
    }
  }
  return cells;
}

function blocksFromCells(cells: Set<string>) {
  const byDate = new Map<string, number[]>();
  for (const cell of cells) {
    const [date, minuteText] = cell.split(":");
    const minute = Number(minuteText);
    byDate.set(date, [...(byDate.get(date) || []), minute]);
  }

  const blocks: PlannerAvailabilityBlock[] = [];
  for (const [date, minutes] of byDate) {
    const sorted = [...new Set(minutes)].sort((left, right) => left - right);
    let blockStart: number | null = null;
    let previous: number | null = null;
    for (const minute of sorted) {
      if (blockStart === null) {
        blockStart = minute;
      } else if (previous !== null && minute !== previous + SLOT_MINUTES) {
        blocks.push({ date, startMinute: blockStart, endMinute: previous + SLOT_MINUTES });
        blockStart = minute;
      }
      previous = minute;
    }
    if (blockStart !== null && previous !== null) {
      blocks.push({ date, startMinute: blockStart, endMinute: previous + SLOT_MINUTES });
    }
  }

  return blocks.sort((left, right) =>
    left.date === right.date ? left.startMinute - right.startMinute : left.date.localeCompare(right.date)
  );
}

function formatMinutes(value: number) {
  const hour24 = Math.floor(value / 60);
  const minute = value % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatWeekday(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", { weekday: "short" });
}

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
}
