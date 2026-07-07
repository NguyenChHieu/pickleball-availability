export type VenueTheme = {
  id: string;
  name: string;
  identity: {
    productLabel: string;
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
    freshnessFallback: "Cached availability",
    emptyHeading: "No cached availability yet",
    emptyBody: "Refresh ProPickle from the extension, then reopen this page.",
    noDaysHeading: "No booking days found",
    noDaysBody: "The latest read did not include visible booking days. Try a manual refresh after the booking page has loaded.",
    errorBody: "Check the link or try the stable fallback page.",
    staleWarning: "Older cached read. Open booking to confirm live availability before making plans.",
    footerNote: "Read-only page. Availability comes from the latest browser-extension read.",
  },
};

export const broadwayTheme: VenueTheme = {
  id: "broadway",
  name: "Broadway Pickleball",
  identity: {
    productLabel: "Court Times",
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
    freshnessFallback: "Cached Broadway availability",
    emptyHeading: "No cached Broadway availability yet",
    emptyBody: "Refresh Broadway Pickleball from the extension, then reopen this page.",
    noDaysHeading: "No Broadway booking days found",
    noDaysBody: "The latest read did not include visible ClubSpark booking days. Try a manual refresh after the schedule has loaded.",
    errorBody: "Check the link or try the Broadway booking page directly.",
    staleWarning: "Older cached read. Open ClubSpark to confirm live availability before making plans.",
    bookingNote: "Availability is visible as guest. Booking may require ClubSpark sign-in.",
    footerNote: "Read-only page. Availability comes from the latest browser-extension read of ClubSpark.",
  },
};

export const northRydeTheme: VenueTheme = {
  id: "northryde",
  name: "North Ryde Pickleball",
  identity: {
    productLabel: "Court Times",
    logoSrc: "/venues/northryde-logo.svg",
    motion: "venue-pop",
  },
  colors: {
    background: "#07100c",
    surface: "#101a15",
    surfaceHigh: "#17241d",
    surfaceHighest: "#203126",
    foreground: "#f4f8f2",
    muted: "#a9b9ad",
    accent: "#1f8bd4",
    highlight: "#c5d400",
    border: "#28382f",
    borderStrong: "#3d5145",
    actionSurface: "#c5d400",
    actionForeground: "#07100c",
    warning: "#f0b429",
  },
  copy: {
    freshnessFallback: "Cached North Ryde availability",
    emptyHeading: "No cached North Ryde availability yet",
    emptyBody: "Refresh North Ryde Pickleball from the extension, then reopen this page.",
    noDaysHeading: "No North Ryde booking days found",
    noDaysBody: "The latest read did not include visible Mindbody booking days. Try a manual refresh after the schedule has loaded.",
    errorBody: "Check the link or open Tennis World North Ryde booking directly.",
    staleWarning: "Older cached read. Open Mindbody to confirm live availability before making plans.",
    bookingNote: "Availability is visible as guest through Mindbody. Booking may require account or payment steps.",
    footerNote: "Read-only page. Availability comes from the latest browser-extension read of the Mindbody booking widget.",
  },
};
