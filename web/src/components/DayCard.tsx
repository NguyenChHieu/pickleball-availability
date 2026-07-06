"use client";

import type { PublicAvailabilityDay } from "@/lib/publicAvailability";
import { useState } from "react";

type DayCardProps = Readonly<{
  day: PublicAvailabilityDay;
  index: number;
}>;

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
}

function splitDateLabel(date: string) {
  const [weekday, ...rest] = date.split(" ");
  return {
    weekday: (weekday || date).replace(/,$/, ""),
    dateDetail: rest.join(" ") || date,
  };
}

function statusLabel(day: PublicAvailabilityDay) {
  if (!day.openIntervals.length) return "No open intervals";
  if (day.levelIntervals.length && day.sameCourtIntervals.length) return "Levels and courts available";
  if (day.levelIntervals.length) return "Booking levels available";
  if (day.sameCourtIntervals.length) return "Same-court runs available";
  if (day.openIntervals.length <= 2) return "Limited slots";
  return "Any-court windows";
}

type DayTab = "overview" | "levels" | "courts";

function continuityMessage(day: PublicAvailabilityDay) {
  if (day.continuityStatus === "failed") {
    return "Provider or court continuity could not be read this time. Overview and Levels are still available.";
  }
  if (day.continuityStatus === "partial") {
    return "Some provider or court continuity could not be read. Overview and Levels are still available.";
  }
  if (day.continuityStatus === "available") {
    return "No same-court or same-provider runs were found for this day. Use the Overview tab for any-court availability.";
  }
  return "Provider or court continuity is not exposed by this booking page yet. Use the Overview tab for any-court availability, then open booking before planning a longer session.";
}

export function DayCard({ day, index }: DayCardProps) {
  const titleId = `stitch-day-${index}`;
  const { weekday, dateDetail } = splitDateLabel(day.date);
  const hoursLabel = `${formatHours(day.totalOpenHours)} HR`;
  const bookingLabel = `Open booking page for ${weekday} ${dateDetail} to choose a time`;
  const tabs: { id: DayTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    ...(day.levelIntervals.length ? [{ id: "levels" as const, label: "Levels" }] : []),
    { id: "courts", label: day.sameCourtIntervals.length ? "Courts" : "Continuity" },
  ];
  const [activeTab, setActiveTab] = useState<DayTab>("overview");
  const selectedTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : "overview";

  return (
    <article className="stitch-day-card" aria-labelledby={titleId}>
      <header className="stitch-day-card__header">
        <div>
          <h2 id={titleId}>
            {weekday} {dateDetail}
          </h2>
          <p>{statusLabel(day)}</p>
        </div>
        <div className="stitch-day-card__actions">
          <span className="stitch-day-card__hours tabular-nums">{hoursLabel}</span>
          {day.bookingUrl ? (
            <a
              className="stitch-day-card__book"
              href={day.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={bookingLabel}
              aria-label={bookingLabel}
            >
              Book
            </a>
          ) : null}
        </div>
      </header>

      {day.openIntervals.length ? (
        <>
          <div className="stitch-day-tabs" role="group" aria-label={`${day.date} availability views`}>
            {tabs.map((tab) => (
              <button
                aria-pressed={selectedTab === tab.id}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {selectedTab === "overview" ? (
            <div
              className="stitch-interval-group"
              id={`${titleId}-overview`}
            >
              <div className="stitch-interval-group__header">
                <h3>Any-court windows</h3>
                <p>Adjacent slots may use different courts or providers.</p>
              </div>
              <ul className="stitch-intervals" aria-label={`${day.date} any-court open windows`}>
                {day.openIntervals.map((interval) => (
                  <li className="stitch-interval" key={`${interval.startTime}-${interval.endTime}`}>
                    <div>
                      <span className="stitch-interval__time tabular-nums">{interval.label}</span>
                      <span className="stitch-interval__detail">{day.title} - at least one court open</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {selectedTab === "levels" && day.levelIntervals.length ? (
            <section
              className="stitch-levels"
              id={`${titleId}-levels`}
            >
              <div className="stitch-interval-group__header">
                <h3>Booking levels</h3>
                <p>Each level is listed separately when the venue exposes service pricing.</p>
              </div>
              <ul>
                {day.levelIntervals.map((level) => (
                  <li key={`${level.levelName}-${level.price}`}>
                    <span>
                      {level.levelName}
                      {level.price ? <small>{level.price}</small> : null}
                    </span>
                    <div>
                      {level.intervals.map((interval) => (
                        <span className="tabular-nums" key={`${level.levelName}-${interval.startTime}-${interval.endTime}`}>
                          {interval.label}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {selectedTab === "courts" ? (
            day.sameCourtIntervals.length ? (
              <section
                className="stitch-same-court"
                id={`${titleId}-courts`}
              >
                <div className="stitch-interval-group__header">
                  <h3>Courts / providers</h3>
                  <p>
                    These runs are grouped by the bookable resource exposed by the venue.
                    {day.continuityStatus === "partial" ? " Some resources could not be read." : ""}
                  </p>
                </div>
                <ul>
                  {day.sameCourtIntervals.map((court) => (
                    <li key={`${court.levelName}-${court.courtName}-${court.price}`}>
                      <span>
                        {court.courtName}
                        {court.levelName || court.price ? (
                          <small>
                            {[court.levelName, court.price].filter(Boolean).join(" - ")}
                          </small>
                        ) : null}
                      </span>
                      <div>
                        {court.intervals.map((interval) => (
                          <span className="tabular-nums" key={`${court.courtName}-${court.levelName}-${interval.startTime}-${interval.endTime}`}>
                            {interval.label}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p
                className="stitch-continuity-note"
                id={`${titleId}-courts`}
              >
                {continuityMessage(day)}
              </p>
            )
          ) : (
            null
          )}
        </>
      ) : (
        <div className="stitch-interval stitch-interval--empty">
          <div>
            <span className="stitch-interval__time">No open intervals</span>
            <span className="stitch-interval__detail">Open booking to confirm the live schedule.</span>
          </div>
        </div>
      )}
    </article>
  );
}
