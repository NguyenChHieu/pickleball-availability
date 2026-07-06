import type { PublicAvailabilityDay } from "@/lib/publicAvailability";

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
  if (day.sameCourtIntervals.length) return "Same-court runs available";
  if (day.openIntervals.length <= 2) return "Limited slots";
  return "Any-court windows";
}

export function DayCard({ day, index }: DayCardProps) {
  const titleId = `stitch-day-${index}`;
  const { weekday, dateDetail } = splitDateLabel(day.date);
  const hoursLabel = `${formatHours(day.totalOpenHours)} HR`;
  const bookingLabel = `Open booking page for ${weekday} ${dateDetail} to choose a time`;

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
          <div className="stitch-interval-group">
            <div className="stitch-interval-group__header">
              <h3>Any-court windows</h3>
              <p>Adjacent slots may use different courts.</p>
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

          {day.sameCourtIntervals.length ? (
            <section className="stitch-same-court" aria-label={`${day.date} same-court runs`}>
              <div className="stitch-interval-group__header">
                <h3>Same-court runs</h3>
                <p>These runs should not require changing courts.</p>
              </div>
              <ul>
                {day.sameCourtIntervals.map((court) => (
                  <li key={court.courtName}>
                    <span>{court.courtName}</span>
                    <div>
                      {court.intervals.map((interval) => (
                        <span className="tabular-nums" key={`${court.courtName}-${interval.startTime}-${interval.endTime}`}>
                          {interval.label}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="stitch-continuity-note">
              Same-court continuity is not exposed by this booking page. Open booking before planning a longer session.
            </p>
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
