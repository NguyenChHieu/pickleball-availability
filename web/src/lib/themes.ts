export type VenueTheme = {
  id: string;
  name: string;
  colors: {
    background: string;
    surface: string;
    foreground: string;
    inverseForeground: string;
    accent: string;
    highlight: string;
    muted: string;
    border: string;
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
  colors: {
    background: "#050505",
    surface: "#ffffff",
    foreground: "#050505",
    inverseForeground: "#ffffff",
    accent: "#0098ff",
    highlight: "#b7ff2a",
    muted: "#6b7280",
    border: "#dce5e9",
    warning: "#b45309",
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

export function getVenueTheme(themeId = "") {
  if (themeId === propickleTheme.id) return propickleTheme;
  return propickleTheme;
}
