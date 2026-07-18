"use client";

import { useState, type FormEvent } from "react";

type VenueOption = {
  id: string;
  name: string;
  summary: string;
};

type PlannerNewFormProps = Readonly<{
  defaultStartDate: string;
  defaultEndDate: string;
  defaultName?: string;
  selectedVenueIds?: string[];
  venues: VenueOption[];
}>;

const DEFAULT_VISIBLE_VENUES = 3;

export function PlannerNewForm({
  defaultName = "Weekend pickleball",
  defaultStartDate,
  defaultEndDate,
  selectedVenueIds,
  venues,
}: PlannerNewFormProps) {
  const [name, setName] = useState(defaultName);
  const [dateStart, setDateStart] = useState(defaultStartDate);
  const [dateEnd, setDateEnd] = useState(defaultEndDate);
  const [preferredStartTime, setPreferredStartTime] = useState("18:00");
  const [preferredEndTime, setPreferredEndTime] = useState("23:00");
  const [minimumDurationMinutes, setMinimumDurationMinutes] = useState(60);
  const [selectedVenueIdsState, setSelectedVenueIds] = useState(() => selectedVenueIds || []);
  const [venueQuery, setVenueQuery] = useState("");
  const [venuesExpanded, setVenuesExpanded] = useState(false);
  const [status, setStatus] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const normalizedVenueQuery = venueQuery.trim().toLowerCase();
  const matchingVenues = venues.filter((venue) =>
    [venue.name, venue.summary, venue.id].some((value) =>
      value.toLowerCase().includes(normalizedVenueQuery)
    )
  );
  const availableVenues = matchingVenues.filter((venue) => !selectedVenueIdsState.includes(venue.id));
  const selectedVenues = matchingVenues.filter((venue) => selectedVenueIdsState.includes(venue.id));
  const visibleAvailableVenues =
    normalizedVenueQuery || venuesExpanded
      ? availableVenues
      : availableVenues.slice(0, DEFAULT_VISIBLE_VENUES);
  const hiddenAvailableVenueCount = availableVenues.length - visibleAvailableVenues.length;

  function toggleVenue(venueId: string) {
    setSelectedVenueIds((current) =>
      current.includes(venueId) ? current.filter((id) => id !== venueId) : [...current, venueId]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setStatus("");
    try {
      const response = await fetch("/api/planner/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          dateStart,
          dateEnd,
          preferredStartTime,
          preferredEndTime,
          minimumDurationMinutes,
          venueIds: selectedVenueIdsState,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create planner.");
      window.location.assign(body.href);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create planner.");
      setIsCreating(false);
    }
  }

  return (
    <main className="planner-shell planner-shell--new">
      <section className="planner-hero" aria-labelledby="planner-new-title">
        <p className="planner-kicker">Group planner</p>
        <h1 id="planner-new-title">Find the court time everyone can actually make.</h1>
        <p>
          Create a secret link, let friends mark their availability, then match the overlap against the
          latest cached venue reads.
        </p>
      </section>

      <form className="planner-form" onSubmit={handleSubmit}>
        <label>
          <span>Event name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
        </label>

        <div className="planner-form__grid">
          <label>
            <span>Start date</span>
            <input type="date" value={dateStart} onChange={(event) => setDateStart(event.target.value)} />
          </label>
          <label>
            <span>End date</span>
            <input type="date" value={dateEnd} onChange={(event) => setDateEnd(event.target.value)} />
          </label>
          <label>
            <span>From</span>
            <input
              type="time"
              step={1800}
              value={preferredStartTime}
              onChange={(event) => setPreferredStartTime(event.target.value)}
            />
          </label>
          <label>
            <span>Until</span>
            <input
              type="time"
              step={1800}
              value={preferredEndTime}
              onChange={(event) => setPreferredEndTime(event.target.value)}
            />
          </label>
        </div>

        <label>
          <span>Minimum session</span>
          <select
            value={minimumDurationMinutes}
            onChange={(event) => setMinimumDurationMinutes(Number(event.target.value))}
          >
            <option value={30}>30 minutes</option>
            <option value={60}>60 minutes</option>
            <option value={90}>90 minutes</option>
            <option value={120}>2 hours</option>
          </select>
        </label>

        <fieldset className="planner-venues">
          <legend>Venues</legend>
          <label className="planner-venue-search">
            <span className="sr-only">Search venues</span>
            <input
              type="search"
              value={venueQuery}
              onChange={(event) => setVenueQuery(event.target.value)}
              placeholder="Search venues"
              autoComplete="off"
            />
          </label>

          {visibleAvailableVenues.length ? (
            <div className="planner-venue-group">
              <p>Available venues</p>
              {visibleAvailableVenues.map((venue) => (
                <VenueChoice
                  checked={false}
                  key={venue.id}
                  onChange={() => toggleVenue(venue.id)}
                  venue={venue}
                />
              ))}
            </div>
          ) : null}

          {!normalizedVenueQuery && availableVenues.length > DEFAULT_VISIBLE_VENUES ? (
            <button
              aria-expanded={venuesExpanded}
              className="planner-venue-expand"
              type="button"
              onClick={() => setVenuesExpanded((current) => !current)}
            >
              {venuesExpanded
                ? "Show fewer venues"
                : `Show ${hiddenAvailableVenueCount} more venue${hiddenAvailableVenueCount === 1 ? "" : "s"}`}
            </button>
          ) : null}

          {selectedVenues.length ? (
            <div className="planner-venue-group">
              <p>Selected ({selectedVenues.length})</p>
              {selectedVenues.map((venue) => (
                <VenueChoice
                  checked
                  key={venue.id}
                  onChange={() => toggleVenue(venue.id)}
                  venue={venue}
                />
              ))}
            </div>
          ) : null}

          {!matchingVenues.length ? (
            <p className="planner-venue-empty">No venues match &quot;{venueQuery.trim()}&quot;.</p>
          ) : null}
        </fieldset>

        {status ? <p className="planner-error">{status}</p> : null}

        <button className="planner-primary" disabled={isCreating || !selectedVenueIdsState.length} type="submit">
          {isCreating ? "Creating..." : "Create planner"}
        </button>
      </form>
    </main>
  );
}

function VenueChoice({
  checked,
  onChange,
  venue,
}: Readonly<{
  checked: boolean;
  onChange: () => void;
  venue: VenueOption;
}>) {
  return (
    <label className="planner-venue-choice">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>
        <strong>{venue.name}</strong>
        <small>{venue.summary}</small>
      </span>
    </label>
  );
}
