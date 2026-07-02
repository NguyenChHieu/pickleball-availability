import type { CSSProperties } from "react";

import { DayCard } from "@/components/DayCard";
import { HeroScene } from "@/components/HeroScene";
import type { PublicAvailability } from "@/lib/publicAvailability";
import { getVenueTheme } from "@/lib/themes";

type AvailabilityPageProps = Readonly<{
  availability: PublicAvailability;
  venueId?: string;
}>;

type ThemeStyle = CSSProperties & Record<`--venue-${string}`, string>;

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
}

function themeStyle(themeId: string): ThemeStyle {
  const theme = getVenueTheme(themeId);
  return {
    "--venue-background": theme.colors.background,
    "--venue-surface": theme.colors.surface,
    "--venue-foreground": theme.colors.foreground,
    "--venue-inverse-foreground": theme.colors.inverseForeground,
    "--venue-accent": theme.colors.accent,
    "--venue-highlight": theme.colors.highlight,
    "--venue-muted": theme.colors.muted,
    "--venue-border": theme.colors.border,
    "--venue-warning": theme.colors.warning,
  };
}

export function AvailabilityPage({ availability, venueId = "propickle" }: AvailabilityPageProps) {
  const themeId = availability.state === "ready" ? availability.themeId : venueId;
  const theme = getVenueTheme(themeId);
  const isReady = availability.state === "ready";
  const venueName = isReady ? availability.venueName : theme.name;
  const freshnessLabel =
    isReady && availability.freshnessLabel
      ? `Last read ${availability.freshnessLabel}`
      : theme.copy.freshnessFallback;
  const dayCount = isReady ? availability.summary.dayCount : 0;
  const openHours = isReady ? formatHours(availability.summary.totalOpenHours) : "0";

  return (
    <main className="availability-page" style={themeStyle(themeId)}>
      <section className="availability-hero" aria-labelledby="availability-title">
        <HeroScene />
        <div className="availability-hero__inner">
          <div className="availability-hero__copy">
            <p className="availability-kicker">{theme.copy.kicker}</p>
            <h1 id="availability-title">{venueName}</h1>
            <p className="availability-freshness tabular-nums">{freshnessLabel}</p>
            {isReady && availability.isStale ? <p className="stale-warning">{theme.copy.staleWarning}</p> : null}
          </div>
          <dl className="availability-summary" aria-label="Availability summary">
            <div>
              <dt>Days</dt>
              <dd>{dayCount}</dd>
            </div>
            <div>
              <dt>Open hours</dt>
              <dd>{openHours}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="availability-section" aria-label="Availability by day">
        <div className="availability-section__inner">{renderAvailabilityContent(availability, theme.copy)}</div>
      </section>

      <footer className="availability-footer">{theme.copy.footerNote}</footer>
    </main>
  );
}

function renderAvailabilityContent(availability: PublicAvailability, copy: ReturnType<typeof getVenueTheme>["copy"]) {
  if (availability.state === "empty") {
    return (
      <section className="state-card" aria-labelledby="empty-title">
        <h2 id="empty-title">{copy.emptyHeading}</h2>
        <p>{copy.emptyBody}</p>
        {availability.fallbackUrl ? (
          <a className="booking-link touch-target" href={availability.fallbackUrl} target="_blank" rel="noopener noreferrer">
            Open booking
          </a>
        ) : null}
      </section>
    );
  }

  if (availability.state === "error" || availability.state === "not-found") {
    return (
      <section className="state-card" aria-labelledby="error-title">
        <h2 id="error-title">We could not load this share page.</h2>
        <p>{copy.errorBody}</p>
      </section>
    );
  }

  if (!availability.days.length) {
    return (
      <section className="state-card" aria-labelledby="no-days-title">
        <h2 id="no-days-title">{copy.noDaysHeading}</h2>
        <p>{copy.noDaysBody}</p>
      </section>
    );
  }

  return (
    <div className="day-card-list">
      {availability.days.map((day, index) => (
        <DayCard key={`${day.date}-${index}`} day={day} index={index} />
      ))}
    </div>
  );
}
