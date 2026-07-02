export type VenueTheme = {
  id: string;
  name: string;
  identity: {
    productLabel: string;
    markLabel: string;
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
    footerNote: string;
  };
};

export const propickleTheme: VenueTheme = {
  id: "propickle",
  name: "ProPickle",
  identity: {
    productLabel: "Availability",
    markLabel: "ProPickle venue mark",
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

export const venueThemes: Record<string, VenueTheme> = {
  [propickleTheme.id]: propickleTheme,
};

export function getVenueTheme(themeId = "") {
  return venueThemes[themeId] ?? propickleTheme;
}
