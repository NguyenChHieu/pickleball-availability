"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ThreeHero } from "@/components/ThreeHero";

type HomeLandingProps = Readonly<{
  featuredSharePath?: string;
}>;

type ThemeMode = "light" | "dark";

const slots = [
  { day: "Tue", times: ["08:00 AM", "09:30 AM", "10:30 AM"] },
  { day: "Wed", times: ["07:00 AM", "08:30 AM"] },
  { day: "Thu", times: ["06:30 PM", "08:00 PM"] },
];

const steps = [
  {
    title: "Extension reads",
    body: "You open the real venue schedule and trigger one polite read from the browser extension.",
    index: "01",
  },
  {
    title: "Web cache updates",
    body: "The web app stores the latest normalized availability so the result stays easy to revisit.",
    index: "02",
  },
  {
    title: "Share the page",
    body: "Friends get a phone-friendly summary of open intervals without raw JSON or booking automation.",
    index: "03",
  },
];

const venues = [
  { name: "ProPickle", status: "Active", detail: "Read-only Playbypoint availability is live." },
  { name: "Broadway", status: "Coming soon", detail: "Next venue target after the provider check." },
  { name: "North Ryde", status: "Coming soon", detail: "Same interface, venue-specific palette." },
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
          <a href="#roadmap">Roadmap</a>
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
              Pickleball Buddy turns venue schedules into a clean cached page, so the useful answer is
              one tap away after the extension reads it.
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
                <a className="home-button home-button--secondary" href="#preview">
                  See sample
                </a>
              )}
            </div>
          </div>

          <div className="home-hero__visual" aria-label="Animated pickleball court preview">
            <ThreeHero />
            <div className="home-preview" id="preview">
              <div className="home-preview__header">
                <div>
                  <p>Sample availability preview</p>
                  <h2>ProPickle demo</h2>
                </div>
                <span>Demo</span>
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
          <span>Read-only</span>
          <span>No booking automation</span>
          <span>Cached share pages</span>
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

        <section className="home-section home-section--split" id="roadmap" aria-labelledby="roadmap-title">
          <div className="home-section__intro">
            <p className="home-eyebrow">Venue roadmap</p>
            <h2 id="roadmap-title">Built to pick up new venues without redesigning the whole app.</h2>
          </div>
          <div className="home-venues">
            {venues.map((venue) => (
              <article className="home-venue" key={venue.name}>
                <div>
                  <h3>{venue.name}</h3>
                  <span>{venue.status}</span>
                </div>
                <p>{venue.detail}</p>
              </article>
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
