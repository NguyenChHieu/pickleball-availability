export type PlannerAvailabilityBlock = {
  date: string;
  startMinute: number;
  endMinute: number;
};

export type PlannerEvent = {
  eventToken: string;
  name: string;
  dateStart: string;
  dateEnd: string;
  preferredStartTime: string;
  preferredEndTime: string;
  minimumDurationMinutes: number;
  venueIds: string[];
  createdAt: string;
};

export type PlannerParticipant = {
  participantId: string;
  eventToken: string;
  displayName: string;
  editToken: string;
  availabilityBlocks: PlannerAvailabilityBlock[];
  createdAt: string;
};

export type PublicPlannerParticipant = Omit<PlannerParticipant, "eventToken" | "editToken">;

export type PlannerVenueInterval = {
  startMinute: number;
  endMinute: number;
  confidence: "same-court" | "any-court";
  courtName?: string;
};

export type PlannerVenueDay = {
  date: string;
  intervals: PlannerVenueInterval[];
};

export type PlannerVenueAvailability = {
  venueId: string;
  venueName: string;
  fallbackUrl: string;
  lastReadAt: string | null;
  freshnessLabel: string;
  isStale: boolean;
  staleThresholdMinutes: number;
  state: "ready" | "empty";
  days: PlannerVenueDay[];
};

export type PlannerRecommendation = {
  id: string;
  venueId: string;
  venueName: string;
  date: string;
  startMinute: number;
  endMinute: number;
  availableParticipantCount: number;
  availableParticipantNames: string[];
  confidence: "same-court" | "any-court";
  courtName?: string;
  freshnessLabel: string;
  isStale: boolean;
};

export type PublicPlannerEventView = {
  event: PlannerEvent;
  participants: PublicPlannerParticipant[];
  venues: PlannerVenueAvailability[];
  recommendations: PlannerRecommendation[];
};
