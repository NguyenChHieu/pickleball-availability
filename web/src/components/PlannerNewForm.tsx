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
  venues: VenueOption[];
}>;

export function PlannerNewForm({ defaultStartDate, defaultEndDate, venues }: PlannerNewFormProps) {
  const [name, setName] = useState("Weekend pickleball");
  const [dateStart, setDateStart] = useState(defaultStartDate);
  const [dateEnd, setDateEnd] = useState(defaultEndDate);
  const [preferredStartTime, setPreferredStartTime] = useState("18:00");
  const [preferredEndTime, setPreferredEndTime] = useState("23:00");
  const [minimumDurationMinutes, setMinimumDurationMinutes] = useState(60);
  const [selectedVenueIds, setSelectedVenueIds] = useState(() => venues.map((venue) => venue.id));
  const [status, setStatus] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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
          venueIds: selectedVenueIds,
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
          {venues.map((venue) => (
            <label className="planner-venue-choice" key={venue.id}>
              <input
                type="checkbox"
                checked={selectedVenueIds.includes(venue.id)}
                onChange={() => toggleVenue(venue.id)}
              />
              <span>
                <strong>{venue.name}</strong>
                <small>{venue.summary}</small>
              </span>
            </label>
          ))}
        </fieldset>

        {status ? <p className="planner-error">{status}</p> : null}

        <button className="planner-primary" disabled={isCreating || !selectedVenueIds.length} type="submit">
          {isCreating ? "Creating..." : "Create planner"}
        </button>
      </form>
    </main>
  );
}
