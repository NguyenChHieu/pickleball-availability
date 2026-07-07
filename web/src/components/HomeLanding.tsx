"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ThreeHero } from "@/components/ThreeHero";

type HomeLandingProps = Readonly<{
  featuredSharePath?: string;
}>;

type ThemeMode = "light" | "dark";

const slots = [
  { day: "Pro", times: ["Playbypoint", "Login-aware", "9 days"] },
  { day: "Bwy", times: ["ClubSpark", "Guest-visible", "9 days"] },
  { day: "NR", times: ["Mindbody", "Fast refresh", "Deep scan"] },
  { day: "SRC", times: ["Playtomic", "Guest JSON", "5 courts"] },
  { day: "HOP", times: ["PodPlay", "Visible rows", "Court labels"] },
];

const steps = [
  {
    title: "Refresh stale",
    body: "The extension checks only venues with missing or older cached results, keeping normal refreshes quick and polite.",
    index: "01",
  },
  {
    title: "Cache updates",
    body: "The web app stores the latest normalized availability so every venue has a share page ready to revisit.",
    index: "02",
  },
  {
    title: "Share or inspect",
    body: "Friends see phone-friendly open intervals, and the popup keeps recent refresh history and timings.",
    index: "03",
  },
];

const venueGroups = [
  {
    label: "Supported now",
    venues: [
      {
        name: "ProPickle",
        status: "Active",
        tone: "active",
        detail: "Playbypoint reader with login-aware setup handling and day booking shortcuts.",
      },
      {
        name: "Broadway Pickleball",
        status: "Active",
        tone: "active",
        detail: "ClubSpark guest availability reader with venue-specific share page styling.",
      },
      {
        name: "North Ryde Pickleball",
        status: "Active",
        tone: "active",
        detail: "Mindbody reader with fast refresh by default and optional same-court deep scan.",
      },
      {
        name: "Sydney Racquet Club",
        status: "Active",
        tone: "active",
        detail: "Mixed padel/pickleball Playtomic venue; this reader uses the pickleball sport feed only.",
      },
      {
        name: "House of Pickle Darling Harbour",
        status: "Active",
        tone: "active",
        detail: "PodPlay DOM reader for visible guest booking rows, preserving exposed court labels where available.",
      },
    ],
  },
  {
    label: "Research queue",
    venues: [
      {
        name: "WOTSO Pickleball",
        status: "Probing",
        tone: "research",
        detail: "Hamlet booking flow is being checked for guest-visible availability and safe read-only hooks.",
      },
    ],
  },
];

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";

  const saved = window.localStorage.getItem("pbb-home-theme");
  if (saved === "light" || saved === "dark") return saved;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function HomeLanding({ featuredSharePath }: HomeLandingProps) {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const hasFeaturedShare = Boolean(featuredSharePath);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTheme(getInitialTheme());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("pbb-home-theme", theme);
  }, [theme]);

  const themeLabel = theme === "dark" ? "Dark" : "Light";

  return (
    <div className="home-shell" data-theme={theme}>
      <header className="home-nav">
        <Link className="home-brand" href="/" aria-label="Pickleball Buddy home">
          <span className="home-brand__mark" aria-hidden="true" />
          <span className="home-brand__full" aria-hidden="true">
            Pickleball Buddy
          </span>
          <span className="home-brand__short" aria-hidden="true">
            PB Buddy
          </span>
        </Link>
        <nav className="home-links" aria-label="Homepage">
          <a href="#how-it-works">How it works</a>
          <a href="#venues">Venues</a>
        </nav>
        <button
          className="home-theme"
          type="button"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        >
          <span aria-hidden="true" />
          {themeLabel}
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
              Pickleball Buddy now tracks ProPickle, Broadway, North Ryde, Sydney Racquet Club, and House of Pickle
              with a small browser extension, cached share pages, refresh history, and venue-specific booking links.
            </p>
            <div className="home-actions">
              <a className="home-button home-button--primary" href="#how-it-works">
                See how it works
              </a>
              {hasFeaturedShare ? (
                <a className="home-button home-button--secondary" href={featuredSharePath}>
                  View availability
                </a>
              ) : (
                <a className="home-button home-button--secondary" href="#venues">
                  See venues
                </a>
              )}
            </div>
          </div>

          <div className="home-hero__visual" aria-label="Animated pickleball court preview">
            <ThreeHero />
            <div className="home-preview" id="preview">
              <div className="home-preview__header">
                <div>
                  <p>Current support snapshot</p>
                  <h2>5 venues live</h2>
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
          <span>5 venues supported</span>
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
            <h2 id="venues-title">Five live venues, with the next booking platform being probed.</h2>
          </div>
          <div className="home-venues">
            {venueGroups.map((group) => (
              <div className="home-venue-group" key={group.label}>
                <p>{group.label}</p>
                {group.venues.map((venue) => (
                  <article className={`home-venue home-venue--${venue.tone}`} key={venue.name}>
                    <div>
                      <h3>{venue.name}</h3>
                      <span>{venue.status}</span>
                    </div>
                    <p>{venue.detail}</p>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="home-note" aria-label="Privacy and scope">
          <h2>Designed to stay boring where it matters.</h2>
          <p>
            The public homepage does not expose share tokens. The share pages show cached availability
            only, and the project stays away from login automation, checkout, payment, and bookings.
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
