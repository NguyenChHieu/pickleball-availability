"use client";

import { type ReactNode, useEffect, useRef } from "react";

type VenueMenuProps = Readonly<{
  className: string;
  panelClassName: string;
  summary: ReactNode;
  children: ReactNode;
}>;

export function VenueMenu({ className, panelClassName, summary, children }: VenueMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeMenu() {
      if (detailsRef.current) detailsRef.current.open = false;
    }

    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current;
      if (!details?.open || !event.target) return;
      if (!details.contains(event.target as Node)) closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <details className={className} ref={detailsRef}>
      <summary>{summary}</summary>
      <div className={panelClassName}>{children}</div>
    </details>
  );
}
