import type { PublicAvailabilityDay } from "@/lib/publicAvailability";

type DayCardProps = Readonly<{
  day: PublicAvailabilityDay;
  index: number;
}>;

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
}

export function DayCard({ day, index }: DayCardProps) {
  const titleId = `day-card-${index}`;
  const openHours = formatHours(day.totalOpenHours);

  return (
    <section className="day-card" aria-labelledby={titleId}>
      <div className="day-card__header">
        <div className="day-card__title-group">
          <h2 id={titleId}>{day.date}</h2>
          <p className="day-card__meta">
            {day.title} - {openHours} open hour(s)
          </p>
        </div>
        {day.bookingUrl ? (
          <a className="booking-link touch-target" href={day.bookingUrl} target="_blank" rel="noopener noreferrer">
            Open booking
          </a>
        ) : null}
      </div>

      {day.openIntervals.length ? (
        <ul className="interval-list" aria-label={`${day.date} open intervals`}>
          {day.openIntervals.map((interval) => (
            <li key={`${interval.startTime}-${interval.endTime}`}>
              <span className="interval-chip tabular-nums">{interval.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="day-card__empty">No open intervals</p>
      )}
    </section>
  );
}
