import type { PublicAvailabilityDay } from "@/lib/publicAvailability";

type DayCardProps = Readonly<{
  day: PublicAvailabilityDay;
  index: number;
}>;

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
}

function openHoursLabel(hours: number) {
  const label = formatHours(hours);
  return `${label} open ${hours === 1 ? "hour" : "hours"}`;
}

function splitDateLabel(date: string) {
  const [weekday, ...rest] = date.split(" ");
  return {
    weekday: weekday || date,
    dateDetail: rest.join(" ") || date,
  };
}

export function DayCard({ day, index }: DayCardProps) {
  const titleId = `day-card-${index}`;
  const openHours = openHoursLabel(day.totalOpenHours);
  const { weekday, dateDetail } = splitDateLabel(day.date);

  return (
    <section className="day-card" aria-labelledby={titleId}>
      <div className="day-card__date">
        <p>{weekday}</p>
        <h2 id={titleId}>{dateDetail}</h2>
      </div>

      <div className="day-card__body">
        <div className="day-card__title-group">
          <p className="day-card__meta">{day.title}</p>
          <p className="day-card__hours tabular-nums">{openHours}</p>
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
      </div>

      {day.bookingUrl ? (
        <div className="day-card__actions">
          <a className="booking-link touch-target" href={day.bookingUrl} target="_blank" rel="noopener noreferrer">
            Open booking
          </a>
        </div>
      ) : null}
    </section>
  );
}
