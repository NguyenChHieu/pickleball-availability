"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type CinematicIntroProps = Readonly<{
  featuredSharePath?: string;
}>;

const beats = [
  {
    eyebrow: "Before play",
    title: "Open courts should not be hard to find.",
    body: "ProPickle Buddy turns scattered booking pages into one clear, read-only view.",
    weight: 1.2,
  },
  {
    eyebrow: "Enter the court",
    title: "One view across the days ahead.",
    body: "Refresh the venues you care about, then keep the latest successful result close.",
    weight: 1.4,
  },
  {
    eyebrow: "The details",
    title: "Availability without the daily clicking.",
    body: "See open intervals, freshness, and court continuity where each venue exposes it.",
    weight: 1.1,
  },
  {
    eyebrow: "Bring your people",
    title: "Pick a time everyone can make.",
    body: "Create a private group planner and compare the overlap with cached venue reads.",
    weight: 1.3,
  },
  {
    eyebrow: "From court to grid",
    title: "Fresh reads become clear choices.",
    body: "Electric blue marks the route. Pickleball lime marks the opportunity.",
    weight: 1.4,
  },
  {
    eyebrow: "ProPickle Buddy",
    title: "Find an available court.",
    body: "Browse the latest saved results, then finish the booking manually with the venue.",
    weight: 1,
  },
] as const;

const totalWeight = beats.reduce((sum, beat) => sum + beat.weight, 0);

function beatForProgress(progress: number) {
  let cursor = 0;
  for (let index = 0; index < beats.length; index += 1) {
    cursor += beats[index].weight / totalWeight;
    if (progress < cursor) return index;
  }
  return beats.length - 1;
}

export function CinematicIntro({ featuredSharePath }: CinematicIntroProps) {
  const worldRef = useRef<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;

    const compactQuery = window.matchMedia("(max-width: 860px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId = 0;

    const update = () => {
      frameId = 0;
      if (compactQuery.matches || reducedMotionQuery.matches) {
        setActiveIndex(0);
        return;
      }

      const rect = world.getBoundingClientRect();
      const travel = Math.max(rect.height - window.innerHeight, 1);
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      const nextIndex = beatForProgress(progress);
      setActiveIndex((current) => (current === nextIndex ? current : nextIndex));
    };

    const scheduleUpdate = () => {
      if (!frameId) frameId = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    compactQuery.addEventListener("change", scheduleUpdate);
    reducedMotionQuery.addEventListener("change", scheduleUpdate);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      compactQuery.removeEventListener("change", scheduleUpdate);
      reducedMotionQuery.removeEventListener("change", scheduleUpdate);
    };
  }, []);

  return (
    <section className="cinematic-world" ref={worldRef} aria-labelledby="cinematic-title">
      <h1 className="sr-only" id="cinematic-title">
        Find an available court without clicking through every day.
      </h1>
      <div className="cinematic-stage">
        <div className="cinematic-media" aria-hidden="true">
          {beats.slice(0, 5).map((beat, index) => (
            <div
              className={`cinematic-frame${activeIndex === index ? " cinematic-frame--active" : ""}`}
              key={beat.eyebrow}
            >
              <Image
                alt=""
                className={`cinematic-sprite cinematic-sprite--${index + 1}`}
                height={1024}
                priority={index === 0}
                quality={84}
                sizes="100vw"
                src="/cinematic/desktop-concept-board.png"
                width={1536}
              />
            </div>
          ))}
          <div
            className={`cinematic-frame cinematic-frame--interface${
              activeIndex === beats.length - 1 ? " cinematic-frame--active" : ""
            }`}
          >
            <Image
              alt=""
              className="cinematic-interface"
              fill
              quality={88}
              sizes="100vw"
              src="/cinematic/interface-dashboard-desktop.png"
            />
          </div>
          <div className="cinematic-scrim" />
        </div>

        <div className="cinematic-chrome" aria-hidden="true">
          <span>Pickleball Buddy</span>
          <span>Read-only availability</span>
        </div>

        <div className="cinematic-copy-stack">
          {beats.map((beat, index) => (
            <div
              className={`cinematic-copy${activeIndex === index ? " cinematic-copy--active" : ""}`}
              key={beat.title}
            >
              <p aria-hidden="true">{beat.eyebrow}</p>
              <h2 aria-hidden="true">{beat.title}</h2>
              <span aria-hidden="true">{beat.body}</span>
              {index === beats.length - 1 ? (
                <div className="cinematic-actions" aria-hidden={activeIndex !== index}>
                  <Link href="/app" tabIndex={activeIndex === index ? 0 : -1}>
                    Find an available court
                  </Link>
                  <Link href="/planner/new" tabIndex={activeIndex === index ? 0 : -1}>
                    Create group planner
                  </Link>
                  {featuredSharePath ? (
                    <a href={featuredSharePath} tabIndex={activeIndex === index ? 0 : -1}>
                      View availability
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="cinematic-mobile-copy">
          <p aria-hidden="true">Read-only Sydney availability</p>
          <h2 aria-hidden="true">Find an available court without clicking through every day.</h2>
          <span aria-hidden="true">
            Browse the latest saved venue reads, share availability, or create a private group planner.
          </span>
          <div className="cinematic-actions">
            <Link href="/app">Find an available court</Link>
            <Link href="/planner/new">Create group planner</Link>
          </div>
        </div>

        <ol className="cinematic-rail" aria-hidden="true">
          {beats.map((beat, index) => (
            <li className={activeIndex === index ? "cinematic-rail__active" : ""} key={beat.eyebrow}>
              {String(index + 1).padStart(2, "0")}
            </li>
          ))}
        </ol>

        <div className="cinematic-scroll-cue" aria-hidden="true">
          <span />
          Scroll to enter
        </div>
      </div>

      <ol className="sr-only">
        {beats.map((beat) => (
          <li key={beat.title}>
            <strong>{beat.title}</strong> {beat.body}
          </li>
        ))}
      </ol>
    </section>
  );
}
