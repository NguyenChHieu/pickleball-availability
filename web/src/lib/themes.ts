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

export const sydneyRacquetTheme: VenueTheme = {
  id: "sydneyracquet",
  name: "Sydney Racquet Club",
  identity: {
    productLabel: "Court Times",
    logoSrc: "/venues/sydney-racquet-logo.svg",
    motion: "venue-pop",
  },
  colors: {
    background: "#fff7fb",
    surface: "#ffffff",
    surfaceHigh: "#f4fbff",
    surfaceHighest: "#e8f7ff",
    foreground: "#102333",
    muted: "#647485",
    accent: "#ff4fa3",
    highlight: "#77d7ff",
    border: "#f1dce9",
    borderStrong: "#f4a8cc",
    actionSurface: "#ff4fa3",
    actionForeground: "#ffffff",
    warning: "#f59e0b",
  },
  copy: {
    freshnessFallback: "Cached Sydney Racquet Club availability",
    emptyHeading: "No cached Sydney Racquet Club availability yet",
    emptyBody: "Refresh Sydney Racquet Club from the extension, then reopen this page.",
    noDaysHeading: "No Sydney Racquet Club booking days found",
    noDaysBody: "The latest read did not include visible Playtomic pickleball days. Try a manual refresh after the public club page has loaded.",
    errorBody: "Check the link or open Sydney Racquet Club pickleball on Playtomic directly.",
    staleWarning: "Older cached read. Open Playtomic and confirm the Pickleball tab before making plans.",
    bookingNote: "Sydney Racquet Club is a mixed padel/pickleball venue. This page reads Playtomic pickleball availability only; Playtomic may still show padel by default.",
    footerNote: "Read-only page. Availability comes from the latest browser-extension read of public Playtomic pickleball availability.",
  },
};

export const houseOfPickleTheme: VenueTheme = {
  id: "houseofpickle-darlingharbour",
  name: "House of Pickle DH",
  identity: {
    productLabel: "Court Times",
    logoSrc: "/venues/house-of-pickle-logo.svg",
    motion: "venue-pop",
  },
  colors: {
    background: "#090909",
    surface: "#141414",
    surfaceHigh: "#1d1d1d",
    surfaceHighest: "#272727",
    foreground: "#fbfbf3",
    muted: "#c4c2b7",
    accent: "#ff4fb8",
    highlight: "#d7ff45",
    border: "#333333",
    borderStrong: "#525252",
    actionSurface: "#d7ff45",
    actionForeground: "#090909",
    warning: "#f5b84b",
  },
  copy: {
    freshnessFallback: "Cached House of Pickle availability",
    emptyHeading: "No cached House of Pickle availability yet",
    emptyBody: "Refresh House of Pickle DH from the extension, then reopen this page.",
    noDaysHeading: "No House of Pickle booking days found",
    noDaysBody: "The latest read did not include visible PodPlay booking rows. Try a manual refresh after the booking page has loaded.",
    errorBody: "Check the link or open House of Pickle DH booking directly.",
    staleWarning: "Older cached read. Open PodPlay to confirm live availability before making plans.",
    bookingNote: "House of Pickle DH availability is read from the visible guest booking page. Booking may require PodPlay sign-in or app steps.",
    footerNote: "Read-only page. Availability comes from the latest browser-extension read of the visible PodPlay booking page.",
  },
};

export const wotsoTheme: VenueTheme = {
  id: "wotso-pyrmont",
  name: "WOTSO Pickleball Pyrmont",
  identity: {
    productLabel: "Court Times",
    logoSrc: "/venues/wotso-logo.svg",
    motion: "venue-pop",
  },
  colors: {
    background: "#f7faf4",
    surface: "#ffffff",
    surfaceHigh: "#eef6e9",
    surfaceHighest: "#dceecf",
    foreground: "#162019",
    muted: "#607067",
    accent: "#58a618",
    highlight: "#111111",
    border: "#d7e5cf",
    borderStrong: "#94bf7d",
    actionSurface: "#58a618",
    actionForeground: "#ffffff",
    warning: "#b7791f",
  },
  copy: {
    freshnessFallback: "Cached WOTSO availability",
    emptyHeading: "No cached WOTSO availability yet",
    emptyBody: "Refresh WOTSO Pickleball Pyrmont from the extension, then reopen this page.",
    noDaysHeading: "No WOTSO booking days found",
    noDaysBody: "The latest read did not include visible Hamlet booking days. Open WOTSO, let the guest session load, then refresh again.",
    errorBody: "Check the link or open the WOTSO booking page directly.",
    staleWarning: "Older cached read. Open WOTSO to confirm live availability before making plans.",
    bookingNote: "WOTSO availability is read from Hamlet after the page creates its guest session. Booking may require WOTSO/Hamlet sign-in or payment steps.",
    footerNote: "Read-only page. Availability comes from the latest browser-extension read of the WOTSO Hamlet booking page.",
  },
};
