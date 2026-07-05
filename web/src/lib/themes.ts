export type VenueTheme = {
  id: string;
  name: string;
  identity: {
    productLabel: string;
    markLabel: string;
    logoSrc: string;
    motion: "venue-pop" | "none";
  };
  colors: {
    background: string;
    surface: string;
    surfaceHigh: string;
    surfaceHighest: string;
    foreground: string;
    muted: string;
    accent: string;
    highlight: string;
    border: string;
    borderStrong: string;
    actionSurface: string;
    actionForeground: string;
    warning: string;
  };
  copy: {
    kicker: string;
    freshnessFallback: string;
    emptyHeading: string;
    emptyBody: string;
    noDaysHeading: string;
    noDaysBody: string;
    errorBody: string;
    staleWarning: string;
    bookingNote?: string;
    footerNote: string;
  };
};

export const propickleTheme: VenueTheme = {
  id: "propickle",
  name: "ProPickle",
  identity: {
    productLabel: "Availability",
    markLabel: "ProPickle venue mark",
    logoSrc: "/venues/propickle-logo.png",
    motion: "venue-pop",
  },
  colors: {
    background: "#050707",
    surface: "#101212",
    surfaceHigh: "#181b1b",
    surfaceHighest: "#202323",
    foreground: "#f1f4f2",
    muted: "#a9b0ad",
    accent: "#3d63e6",
    highlight: "#aeea2f",
    border: "#2b3030",
    borderStrong: "#3a4040",
    actionSurface: "#e8eeeb",
    actionForeground: "#050707",
    warning: "#f59e0b",
  },
  copy: {
    kicker: "Cached court availability",
    freshnessFallback: "Cached availability",
    emptyHeading: "No cached availability yet",
    emptyBody: "Refresh ProPickle from the extension, then reopen this page.",
    noDaysHeading: "No booking days found",
    noDaysBody: "The latest read did not include visible booking days. Try a manual refresh after the booking page has loaded.",
    errorBody: "Check the link or try the stable fallback page.",
    staleWarning: "This is an older read. Open booking to confirm live availability before making plans.",
    footerNote: "Read-only page. Availability comes from the latest browser-extension read.",
  },
};

export const broadwayTheme: VenueTheme = {
  id: "broadway",
  name: "Broadway Pickleball",
  identity: {
    productLabel: "Court Times",
    markLabel: "Broadway venue mark",
    logoSrc: "/venues/broadway-logo.png",
    motion: "venue-pop",
  },
  colors: {
    background: "#f5fbfe",
    surface: "#ffffff",
    surfaceHigh: "#edf8fc",
    surfaceHighest: "#dff1f7",
    foreground: "#0d2635",
    muted: "#557382",
    accent: "#2d92cc",
    highlight: "#6fc75f",
    border: "#d8e8ef",
    borderStrong: "#a9c8d6",
    actionSurface: "#2d92cc",
    actionForeground: "#ffffff",
    warning: "#b7791f",
  },
  copy: {
    kicker: "Cached ClubSpark availability",
    freshnessFallback: "Cached Broadway availability",
    emptyHeading: "No cached Broadway availability yet",
    emptyBody: "Refresh Broadway Pickleball from the extension, then reopen this page.",
    noDaysHeading: "No Broadway booking days found",
    noDaysBody: "The latest read did not include visible ClubSpark booking days. Try a manual refresh after the schedule has loaded.",
    errorBody: "Check the link or try the Broadway booking page directly.",
    staleWarning: "This is an older read. Open ClubSpark to confirm live availability before making plans.",
    bookingNote: "Availability is visible as guest. Booking may require ClubSpark sign-in.",
    footerNote: "Read-only page. Availability comes from the latest browser-extension read of ClubSpark.",
  },
};

export const venueThemes: Record<string, VenueTheme> = {
  [propickleTheme.id]: propickleTheme,
  [broadwayTheme.id]: broadwayTheme,
};

export function getVenueTheme(themeId = "") {
  return venueThemes[themeId] ?? propickleTheme;
}
