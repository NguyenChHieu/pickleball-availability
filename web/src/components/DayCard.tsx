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
  if (day.openIntervals.length <= 2) return "Limited slots";
  return "Open availability";
}

export function DayCard({ day, index }: DayCardProps) {
  const titleId = `stitch-day-${index}`;
  const { weekday, dateDetail } = splitDateLabel(day.date);
  const hoursLabel = `${formatHours(day.totalOpenHours)} HR`;

  return (
    <article className="stitch-day-card" aria-labelledby={titleId}>
      <header className="stitch-day-card__header">
        <div>
          <h2 id={titleId}>
            {weekday} {dateDetail}
          </h2>
          <p>{statusLabel(day)}</p>
        </div>
        <span className="tabular-nums">{hoursLabel}</span>
      </header>

      {day.openIntervals.length ? (
        <ul className="stitch-intervals" aria-label={`${day.date} open intervals`}>
          {day.openIntervals.map((interval) => (
            <li className="stitch-interval" key={`${interval.startTime}-${interval.endTime}`}>
              <div>
                <span className="stitch-interval__time tabular-nums">{interval.label}</span>
                <span className="stitch-interval__detail">{day.title} - available court window</span>
              </div>
              {day.bookingUrl ? (
                <a href={day.bookingUrl} target="_blank" rel="noopener noreferrer">
                  Book
                </a>
              ) : (
                <span className="stitch-interval__disabled">Book</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="stitch-interval stitch-interval--empty">
          <div>
            <span className="stitch-interval__time">No open intervals</span>
            <span className="stitch-interval__detail">Open booking to confirm the live schedule.</span>
          </div>
          <span className="stitch-interval__disabled">Full</span>
        </div>
      )}

      {day.bookingUrl ? (
        <a className="stitch-day-card__reserve" href={day.bookingUrl} target="_blank" rel="noopener noreferrer">
          Reserve Court
        </a>
      ) : null}
    </article>
  );
}
