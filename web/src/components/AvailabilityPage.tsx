import { DayCard } from "@/components/DayCard";
import type { PublicAvailability, PublicAvailabilityReady } from "@/lib/publicAvailability";
import { getVenueTheme, type VenueTheme } from "@/lib/themes";
import type { CSSProperties } from "react";

type AvailabilityPageProps = Readonly<{
  availability: PublicAvailability;
  venueId?: string;
}>;

type ThemeStyle = CSSProperties & Record<`--venue-${string}`, string>;

function hexToRgbTriplet(hex: string) {
  const normalized = hex.trim().replace(/^#/, "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : normalized;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) return "0 0 0";

  return `${Number.parseInt(expanded.slice(0, 2), 16)} ${Number.parseInt(
    expanded.slice(2, 4),
    16
  )} ${Number.parseInt(expanded.slice(4, 6), 16)}`;
}

function venueThemeStyle(theme: VenueTheme): ThemeStyle {
  return {
    "--venue-background": theme.colors.background,
    "--venue-background-rgb": hexToRgbTriplet(theme.colors.background),
    "--venue-surface": theme.colors.surface,
    "--venue-surface-high": theme.colors.surfaceHigh,
    "--venue-surface-highest": theme.colors.surfaceHighest,
    "--venue-foreground": theme.colors.foreground,
    "--venue-foreground-rgb": hexToRgbTriplet(theme.colors.foreground),
    "--venue-muted": theme.colors.muted,
    "--venue-accent": theme.colors.accent,
    "--venue-accent-rgb": hexToRgbTriplet(theme.colors.accent),
    "--venue-highlight": theme.colors.highlight,
    "--venue-highlight-rgb": hexToRgbTriplet(theme.colors.highlight),
    "--venue-border": theme.colors.border,
    "--venue-border-strong": theme.colors.borderStrong,
    "--venue-action-surface": theme.colors.actionSurface,
    "--venue-action-foreground": theme.colors.actionForeground,
    "--venue-warning": theme.colors.warning,
  };
}

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
}

function displayFreshness(label: string) {
  return label.replace(/^Last read\s+/i, "");
}

function firstOpenSlot(availability: PublicAvailabilityReady) {
  for (const day of availability.days) {
    const interval = day.openIntervals[0];
    if (interval) return interval.startTime;
  }

  return "--";
}

function intervalCount(availability: PublicAvailabilityReady) {
  return availability.days.reduce((count, day) => count + day.openIntervals.length, 0);
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
  const syncedAt = displayFreshness(freshnessLabel);
  const fallbackUrl = availability.fallbackUrl || "#";
  const availableIntervals = isReady ? intervalCount(availability) : 0;
  const openHours = isReady ? formatHours(availability.summary.totalOpenHours) : "0";
  const nextSlot = isReady ? firstOpenSlot(availability) : "--";

  return (
    <div
      className="stitch-page"
      data-venue-motion={theme.identity.motion}
      data-venue-theme={theme.id}
      style={venueThemeStyle(theme)}
    >
      <header className="stitch-topbar">
        <div className="stitch-topbar__inner">
          <a className="stitch-brand" href={fallbackUrl} target="_blank" rel="noopener noreferrer">
            <span className="stitch-brand__icon" aria-hidden="true" />
            <span className="stitch-brand__copy">
              <span className="stitch-brand__venue">{venueName}</span>
              <span className="stitch-brand__product">{theme.identity.productLabel}</span>
            </span>
          </a>
          <div className="stitch-topbar__actions" aria-label="Share page status">
            <nav className="stitch-nav" aria-label="Primary">
              <a href="#schedule">Schedule</a>
              <span>Venues</span>
            </nav>
            <span className="stitch-refresh" aria-hidden="true" />
          </div>
        </div>
      </header>

      <div className="stitch-freshness">
        <div className="stitch-freshness__inner">
          <span aria-hidden="true" />
          <p className="tabular-nums">Sync: {syncedAt}</p>
        </div>
      </div>

      <main className="stitch-main" id="schedule">
        <section className="stitch-summary" aria-labelledby="availability-title">
          <div className="stitch-summary__heading">
            <div>
              <h1 id="availability-title">Live Courts</h1>
              <p>
                {venueName} - Open play and reservations
              </p>
            </div>
            <div className="stitch-active">
              <span>
                <span aria-hidden="true" />
                Active
              </span>
              <p className="tabular-nums">Synced {syncedAt}</p>
            </div>
          </div>

          {isReady && availability.isStale ? <p className="stitch-warning">{theme.copy.staleWarning}</p> : null}

          <dl className="stitch-metrics" aria-label="Availability summary">
            <div className="stitch-metric stitch-metric--accent">
              <dt>Available</dt>
              <dd className="tabular-nums">{availableIntervals}</dd>
            </div>
            <div className="stitch-metric">
              <dt>Open Hours</dt>
              <dd className="tabular-nums">{openHours}</dd>
            </div>
            <div className="stitch-metric">
              <dt>Next Slot</dt>
              <dd className="tabular-nums">{nextSlot}</dd>
            </div>
          </dl>
        </section>

        {renderAvailabilityContent(availability, theme.copy)}

        <section className="stitch-promo" aria-label="System status">
          <div>
            <p>Elite Performance Access</p>
            <span>Join ProPickle for advance booking.</span>
          </div>
          <div>
            <span className="stitch-bolt" aria-hidden="true" />
            <div>
              <p>System Status</p>
              <span>Live court tracking active.</span>
            </div>
          </div>
        </section>
      </main>

      <div className="stitch-sticky">
        <div className="stitch-sticky__inner">
          <div>
            <span>Latest read</span>
            <strong className="tabular-nums">{syncedAt}</strong>
          </div>
          <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
            Open Booking
          </a>
        </div>
      </div>

      <nav className="stitch-mobile-nav" aria-label="Mobile">
        <a href="#schedule" aria-current="page">
          <span className="stitch-nav-icon stitch-nav-icon--schedule" aria-hidden="true" />
          <span>Schedules</span>
        </a>
        <span>
          <span className="stitch-nav-icon stitch-nav-icon--courts" aria-hidden="true" />
          <span>Courts</span>
        </span>
        <span>
          <span className="stitch-nav-icon stitch-nav-icon--settings" aria-hidden="true" />
          <span>Preferences</span>
        </span>
      </nav>

      <footer className="stitch-footer">{theme.copy.footerNote}</footer>
    </div>
  );
}

function renderAvailabilityContent(availability: PublicAvailability, copy: ReturnType<typeof getVenueTheme>["copy"]) {
  if (availability.state === "empty") {
    return (
      <section className="stitch-state" aria-labelledby="empty-title">
        <h2 id="empty-title">{copy.emptyHeading}</h2>
        <p>{copy.emptyBody}</p>
        {availability.fallbackUrl ? (
          <a href={availability.fallbackUrl} target="_blank" rel="noopener noreferrer">
            Open booking
          </a>
        ) : null}
      </section>
    );
  }

  if (availability.state === "error" || availability.state === "not-found") {
    return (
      <section className="stitch-state" aria-labelledby="error-title">
        <h2 id="error-title">We could not load this share page.</h2>
        <p>{copy.errorBody}</p>
      </section>
    );
  }

  if (!availability.days.length) {
    return (
      <section className="stitch-state" aria-labelledby="no-days-title">
        <h2 id="no-days-title">{copy.noDaysHeading}</h2>
        <p>{copy.noDaysBody}</p>
      </section>
    );
  }

  return (
    <div className="stitch-schedule">
      {availability.days.map((day, index) => (
        <DayCard key={`${day.date}-${index}`} day={day} index={index} />
      ))}
    </div>
  );
}
