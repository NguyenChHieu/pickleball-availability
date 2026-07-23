"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ThreeHero } from "@/components/ThreeHero";
import { venues } from "@/lib/venues";

type HomeLandingProps = Readonly<{
  featuredSharePath?: string;
  venueFreshness?: VenueFreshness[];
}>;

type ThemeMode = "light" | "dark";
type VenueFreshness = Readonly<{
  id: string;
  label: string;
  detail: string;
  status: "fresh" | "stale" | "empty";
}>;

const THEME_STORAGE_KEY = "pbb-home-theme-v2";

const slots = [
  { day: "Pro", times: ["Playbypoint", "Login-aware", "9 days"] },
  { day: "Bwy", times: ["ClubSpark", "Guest-visible", "9 days"] },
  { day: "NR", times: ["Mindbody", "Fast refresh", "Deep scan"] },
  { day: "SRC", times: ["Playtomic", "Guest JSON", "5 courts"] },
  { day: "HOP", times: ["PodPlay", "Visible rows", "Court labels"] },
  { day: "WOT", times: ["Hamlet", "Guest session", "2 courts"] },
];

const steps = [
  {
    title: "Refresh stale",
    body: "The extension reads supported booking pages and updates cached availability pages for each venue.",
    index: "01",
  },
  {
    title: "Share availability",
    body: "Availability links are venue-specific cached pages created by the extension, with secret tokens kept out of the public homepage.",
    index: "02",
  },
  {
    title: "Plan a group hit",
    body: "Planner links come from the web app: friends mark times, then cached venue freshness helps rank the best options.",
    index: "03",
  },
];

const venueCount = venues.length;

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;

  return "dark";
}

export function HomeLanding({ featuredSharePath, venueFreshness = [] }: HomeLandingProps) {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const hasFeaturedShare = Boolean(featuredSharePath);
  const freshnessById = new Map(venueFreshness.map((item) => [item.id, item]));
  const homeVenues = venues.map((venue) => ({
    id: venue.id,
    name: venue.name,
    detail: venue.summary,
    freshness: freshnessById.get(venue.id) || {
      id: venue.id,
      label: "No cache",
      detail: "Refresh from extension",
      status: "empty" as const,
    },
  }));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTheme(getInitialTheme());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div className="home-shell" data-theme={theme}>
      <header className="home-nav">
        <Link className="home-brand" href="/">
          <span className="home-brand__mark" aria-hidden="true" />
          <span>Pickleball Buddy</span>
        </Link>
        <nav className="home-links" aria-label="Homepage">
          <a href="#how-it-works">How it works</a>
          <a href="#venues">Venues</a>
          <Link href="/app">Dashboard</Link>
          <Link href="/planner/new">Planner</Link>
        </nav>
        <button
          className="home-theme"
          type="button"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        >
          <span aria-hidden="true">{theme === "dark" ? "☾" : "☀"}</span>
        </button>
      </header>

      <main>
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero__copy">
            <p className="home-kicker">
              <span aria-hidden="true" />
              Public read-only availability
            </p>
            <h1 id="home-title">Stop clicking through every day just to find open court time.</h1>
            <p className="home-lede">
              Pickleball Buddy tracks {venueCount} Sydney pickleball venues with a small browser extension, cached
              availability pages, group planner links, refresh history, and venue-specific booking links.
            </p>
            <div className="home-actions">
              <Link className="home-button home-button--primary" href="/app">
                Open dashboard
              </Link>
              <Link className="home-button home-button--secondary" href="/planner/new">
                Create group planner
              </Link>
              {hasFeaturedShare ? (
                <a className="home-button home-button--secondary" href={featuredSharePath}>
                  View availability
                </a>
              ) : null}
            </div>
          </div>

          <div className="home-hero__visual" aria-label="Animated pickleball court preview">
            <ThreeHero />
            <div className="home-preview" id="preview">
              <div className="home-preview__header">
                <div>
                  <p>Current support snapshot</p>
                  <h2>{venueCount} venues live</h2>
                </div>
                <span>Read-only</span>
              </div>
              <div className="home-slot-list">
                {slots.map((day) => (
                  <div className="home-slot-row" key={day.day}>
                    <span>{day.day}</span>
                    <div>
                      {day.times.map((time) => (
                        <span key={time}>{time}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="home-band" aria-label="Project guardrails">
          <span>{venueCount} venues supported</span>
          <span>5 min stale refresh</span>
          <span>No booking automation</span>
        </section>

        <section className="home-section" id="how-it-works" aria-labelledby="how-title">
          <div className="home-section__intro">
            <p className="home-eyebrow">How it works</p>
            <h2 id="how-title">A small pipeline for the answer players actually want.</h2>
          </div>
          <div className="home-steps">
            {steps.map((step) => (
              <article className="home-step" key={step.title}>
                <span>{step.index}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section home-section--split" id="venues" aria-labelledby="venues-title">
          <div className="home-section__intro">
            <p className="home-eyebrow">Venues</p>
            <h2 id="venues-title">{venueCount} live venues across six booking platforms.</h2>
          </div>
          <div
            aria-label={`${venueCount} supported venues. Scroll to explore the list.`}
            className="home-venues"
            role="region"
            tabIndex={0}
          >
            <div className="home-venue-group-label">
              <p>Supported now</p>
              <span>
                {venueCount} venues <span aria-hidden="true">↓</span>
              </span>
            </div>
            {homeVenues.map((venue) => (
              <article className="home-venue" key={venue.id}>
                <div>
                  <h3>{venue.name}</h3>
                  <span className={`home-venue-status home-venue-status--${venue.freshness.status}`}>
                    {venue.freshness.label}
                  </span>
                </div>
                <small>{venue.freshness.detail}</small>
                <p>{venue.detail}</p>
                <Link className="home-venue__link" href={`/planner/new?venues=${encodeURIComponent(venue.id)}`}>
                  Plan with this venue
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="home-note" aria-label="Privacy and scope">
          <h2>Designed to stay boring where it matters.</h2>
          <p>
            The public homepage does not expose share tokens. The share pages show cached availability
            only. Planner links are created separately for groups, and the project stays away from
            login automation, checkout, payment, and bookings.
          </p>
        </section>
      </main>

      <footer className="home-footer">
        <span>Pickleball Availability Buddy</span>
        <span>Last scraped by the extension. Displayed by the web app.</span>
      </footer>
    </div>
  );
}
