"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

type VenueMenuLink = Readonly<{
  href: string;
  id: string;
  isCurrent: boolean;
  name: string;
  summary: string;
}>;

type VenueMenuProps = Readonly<{
  className: string;
  links: readonly VenueMenuLink[];
  panelClassName: string;
  summary: ReactNode;
}>;

const DEFAULT_VISIBLE_VENUES = 3;

export function VenueMenu({
  className,
  links,
  panelClassName,
  summary,
}: VenueMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const matchingLinks = links.filter((venue) =>
    [venue.name, venue.summary, venue.id].some((value) =>
      value.toLowerCase().includes(normalizedQuery)
    )
  );
  const availableLinks = matchingLinks.filter((venue) => !venue.isCurrent);
  const currentLinks = matchingLinks.filter((venue) => venue.isCurrent);
  const visibleAvailableLinks =
    normalizedQuery || expanded
      ? availableLinks
      : availableLinks.slice(0, DEFAULT_VISIBLE_VENUES);
  const hiddenAvailableCount = availableLinks.length - visibleAvailableLinks.length;

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
      <div className={panelClassName}>
        <label className="stitch-venue-search">
          <span className="sr-only">Search venues</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search venues"
            autoComplete="off"
          />
        </label>

        {visibleAvailableLinks.length ? (
          <VenueLinkGroup label="Available venues" links={visibleAvailableLinks} />
        ) : null}

        {!normalizedQuery && availableLinks.length > DEFAULT_VISIBLE_VENUES ? (
          <button
            aria-expanded={expanded}
            className="stitch-venue-expand"
            type="button"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded
              ? "Show fewer venues"
              : `Show ${hiddenAvailableCount} more venue${hiddenAvailableCount === 1 ? "" : "s"}`}
          </button>
        ) : null}

        {currentLinks.length ? (
          <VenueLinkGroup label="Current venue" links={currentLinks} />
        ) : null}

        {!matchingLinks.length ? (
          <p className="stitch-venue-empty">
            No venues match &quot;{query.trim()}&quot;.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function VenueLinkGroup({
  label,
  links,
}: Readonly<{ label: string; links: readonly VenueMenuLink[] }>) {
  return (
    <div className="stitch-venue-group">
      <p>{label}</p>
      {links.map((venue) => {
        const content = (
          <>
            <span>{venue.name}</span>
            <small>{venue.isCurrent ? "Current venue" : "View availability"}</small>
          </>
        );

        return venue.isCurrent ? (
          <span
            className="stitch-venue-link stitch-venue-link--current"
            aria-current="page"
            key={venue.id}
          >
            {content}
          </span>
        ) : (
          <a className="stitch-venue-link" href={venue.href} key={venue.id}>
            {content}
          </a>
        );
      })}
    </div>
  );
}
