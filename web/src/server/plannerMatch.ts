import type {
  PlannerAvailabilityBlock,
  PlannerEvent,
  PlannerParticipant,
  PlannerRecommendation,
  PlannerVenueAvailability,
  PlannerVenueInterval,
} from "./plannerTypes";

const SLOT_MINUTES = 30;

type ParticipantBand = {
  date: string;
  startMinute: number;
  endMinute: number;
  participantIds: string[];
  participantNames: string[];
};

export function parseTimeToMinutes(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;

  const amPmMatch = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (amPmMatch) {
    const hour = Number(amPmMatch[1]);
    const minute = Number(amPmMatch[2] || 0);
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    const normalizedHour =
      amPmMatch[3] === "pm" ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
    return normalizedHour * 60 + minute;
  }

  const twentyFourHourMatch = text.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHourMatch) {
    const hour = Number(twentyFourHourMatch[1]);
    const minute = Number(twentyFourHourMatch[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  return null;
}

export function formatMinutes(value: number) {
  const hour24 = Math.floor(value / 60);
  const minute = value % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function dateRange(dateStart: string, dateEnd: string) {
  const dates: string[] = [];
  const start = new Date(`${dateStart}T00:00:00`);
  const end = new Date(`${dateEnd}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return dates;

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(formatLocalIsoDate(cursor));
  }

  return dates;
}

function formatLocalIsoDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function mergeBlocks(blocks: PlannerAvailabilityBlock[]) {
  const sorted = [...blocks]
    .filter((block) => block.date && block.endMinute > block.startMinute)
    .sort((left, right) =>
      left.date === right.date ? left.startMinute - right.startMinute : left.date.localeCompare(right.date)
    );
  const merged: PlannerAvailabilityBlock[] = [];

  for (const block of sorted) {
    const last = merged.at(-1);
    if (last && last.date === block.date && last.endMinute >= block.startMinute) {
      last.endMinute = Math.max(last.endMinute, block.endMinute);
    } else {
      merged.push({ ...block });
    }
  }

  return merged;
}

function participantCoversSlot(blocks: PlannerAvailabilityBlock[], date: string, startMinute: number) {
  const endMinute = startMinute + SLOT_MINUTES;
  return blocks.some(
    (block) => block.date === date && block.startMinute <= startMinute && block.endMinute >= endMinute
  );
}

function buildParticipantBands(
  event: PlannerEvent,
  participants: Pick<PlannerParticipant, "participantId" | "displayName" | "availabilityBlocks">[]
) {
  const dates = dateRange(event.dateStart, event.dateEnd);
  const preferredStart = parseTimeToMinutes(event.preferredStartTime) ?? 18 * 60;
  const preferredEnd = parseTimeToMinutes(event.preferredEndTime) ?? 23 * 60;
  const bands: ParticipantBand[] = [];

  for (const date of dates) {
    let openBand: ParticipantBand | null = null;
    for (let startMinute = preferredStart; startMinute + SLOT_MINUTES <= preferredEnd; startMinute += SLOT_MINUTES) {
      const available = participants
        .filter((participant) => participantCoversSlot(participant.availabilityBlocks, date, startMinute))
        .map((participant) => ({
          id: participant.participantId,
          name: participant.displayName,
        }));

      if (!available.length) {
        if (openBand) bands.push(openBand);
        openBand = null;
        continue;
      }

      const participantIds = available.map((participant) => participant.id);
      const participantNames = available.map((participant) => participant.name);
      const samePeople =
        openBand &&
        openBand.participantIds.length === participantIds.length &&
        openBand.participantIds.every((id, index) => id === participantIds[index]);

      if (openBand && samePeople) {
        openBand.endMinute = startMinute + SLOT_MINUTES;
      } else {
        if (openBand) bands.push(openBand);
        openBand = {
          date,
          startMinute,
          endMinute: startMinute + SLOT_MINUTES,
          participantIds,
          participantNames,
        };
      }
    }
    if (openBand) bands.push(openBand);
  }

  return bands;
}

function intersectIntervals(
  band: ParticipantBand,
  interval: PlannerVenueInterval,
  minimumDurationMinutes: number
) {
  const startMinute = Math.max(band.startMinute, interval.startMinute);
  const endMinute = Math.min(band.endMinute, interval.endMinute);
  if (endMinute - startMinute < minimumDurationMinutes) return null;
  return { startMinute, endMinute };
}

export function buildPlannerRecommendations(
  event: PlannerEvent,
  participants: Pick<PlannerParticipant, "participantId" | "displayName" | "availabilityBlocks">[],
  venues: PlannerVenueAvailability[]
) {
  const participantBands = buildParticipantBands(event, participants);
  const recommendations: PlannerRecommendation[] = [];

  for (const venue of venues) {
    if (venue.state !== "ready") continue;
    for (const day of venue.days) {
      const bandsForDay = participantBands.filter((band) => band.date === day.date);
      for (const band of bandsForDay) {
        for (const interval of day.intervals) {
          const intersection = intersectIntervals(band, interval, event.minimumDurationMinutes);
          if (!intersection) continue;
          recommendations.push({
            id: [
              venue.venueId,
              day.date,
              intersection.startMinute,
              intersection.endMinute,
              interval.confidence,
              interval.courtName || "any",
            ].join(":"),
            venueId: venue.venueId,
            venueName: venue.venueName,
            date: day.date,
            startMinute: intersection.startMinute,
            endMinute: intersection.endMinute,
            availableParticipantCount: band.participantIds.length,
            availableParticipantNames: band.participantNames,
            confidence: interval.confidence,
            courtName: interval.courtName,
            freshnessLabel: venue.freshnessLabel,
            isStale: venue.isStale,
          });
        }
      }
    }
  }

  return recommendations.sort((left, right) => {
    const people = right.availableParticipantCount - left.availableParticipantCount;
    if (people) return people;
    const continuity = confidenceScore(right.confidence) - confidenceScore(left.confidence);
    if (continuity) return continuity;
    const freshness = Number(left.isStale) - Number(right.isStale);
    if (freshness) return freshness;
    const date = left.date.localeCompare(right.date);
    if (date) return date;
    return left.startMinute - right.startMinute;
  });
}

function confidenceScore(confidence: PlannerRecommendation["confidence"]) {
  return confidence === "same-court" ? 1 : 0;
}
