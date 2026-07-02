"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

export function HeroScene() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (prefersReducedMotion.matches) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const nextProgress = Math.min(window.scrollY / 420, 1);
      setScrollProgress(nextProgress);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className="hero-scene"
      aria-hidden="true"
      style={
        {
          "--hero-shift": `${scrollProgress * 26}px`,
          "--hero-tilt": `${scrollProgress * -4}deg`,
          "--hero-ball-spin": `${scrollProgress * 42}deg`,
        } as CSSProperties
      }
    >
      <div className="hero-scene__court">
        <span className="hero-scene__line hero-scene__line--center" />
        <span className="hero-scene__line hero-scene__line--left" />
        <span className="hero-scene__line hero-scene__line--right" />
        <span className="hero-scene__line hero-scene__line--kitchen" />
      </div>
      <div className="hero-scene__ball">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
