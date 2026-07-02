---
phase: 1
slug: venue-themed-availability-ui
status: approved
shadcn_initialized: false
preset: none
created: 2026-07-02
---

# Phase 1 - UI Design Contract

> Visual and interaction contract for Phase 1: Venue-Themed Availability UI. Generated for the ProPickle polished availability page while preserving the current backend share page fallback.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none for current repo; manual Next.js app setup in `web/` |
| Preset | not applicable |
| Component library | none required for Phase 1 |
| Icon library | lucide-react if icons are added in `web/`; otherwise none |
| Font | system sans stack: Inter-compatible `-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif` |

Source notes:
- `components.json` is absent and no React/Next/Vite app exists yet, so shadcn is not initialized in this phase contract.
- Current `extension/` remains plain Chrome MV3 JavaScript.
- Current `server/` remains dependency-free CommonJS backend and keeps `/s/:shareToken/:venueId` stable as fallback.
- New polished UI must live in a separate `web/` Next.js TypeScript app that runs alongside the backend share page first.

---

## Visual Identity

| Role | Contract |
|------|----------|
| Product feel | Memorable ProPickle product page, not a utility table. Energetic first impression with immediate availability readability. |
| Venue signal | The first viewport must clearly show `ProPickle`, cached freshness, and enough of the first day card to show the page is availability-first. |
| Brand cues | Black/white base, electric blue accents, pickleball green highlights, court-line geometry, ball texture or ball motion in hero only. |
| Theming model | Venue theme values must be data-driven and separate from rendering logic. Future venues must be able to provide name, colors, booking URL, hero treatment, and theme copy without forking page components. |
| Readability priority | Availability cards, interval chips, freshness, and booking actions take priority over decorative hero/canvas/motion. |

Do not use a generic SaaS dashboard look. Do not use beige, purple-blue gradients, oversized marketing cards, or decorative blobs. Use restrained sport/product energy with strong contrast.

---

## Spacing Scale

Declared values (multiples of 4 only):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, chip internal icon/text gaps, compact metadata gaps |
| sm | 8px | Chip gaps, small button gaps, card internal row gaps |
| md | 16px | Default card padding on mobile, vertical rhythm inside day cards |
| lg | 24px | Mobile page padding, section padding, hero-to-content gap |
| xl | 32px | Desktop card padding, grid gutters, major content grouping |
| 2xl | 48px | Desktop section breaks, hero content spacing |
| 3xl | 64px | Maximum page-level vertical spacing on desktop |

Exceptions:
- Minimum touch target for actionable controls is 44px height.
- Card radius is 8px maximum.
- Interval chips may use 999px radius because they are compact pills, not layout cards.
- Hero/canvas scene may use fluid dimensions, but its reserved layout height must be stable to avoid content jumps.

---

## Typography

Use exactly these type sizes for Phase 1 UI work:

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px | 400 | 1.5 |
| Label | 14px | 600 | 1.35 |
| Heading | 20px | 600 | 1.2 |
| Display | 36px | 600 | 1.1 |

Rules:
- Only weights 400 and 600 are allowed.
- Do not scale font sizes continuously with viewport width. Create responsive display impact through spacing, layout, and hero composition instead of additional font sizes.
- Use tabular numerals for times and freshness if available.
- Long venue names and interval labels must wrap cleanly; text must never overflow cards or buttons.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | #050505 | Page shell, hero field, high-contrast brand areas |
| Secondary (30%) | #FFFFFF | Availability cards, readable content surfaces, modal-free state surfaces |
| Accent (10%) | #0098FF | Primary action border/fill, active focus ring, selected/current emphasis, hero court glow |
| Highlight | #B7FF2A | Pickleball availability highlight, interval chip accent, positive open-state marker |
| Muted | #6B7280 | Secondary metadata such as last read qualifier and footer text |
| Border | #DCE5E9 | Card boundaries and low-emphasis dividers on light surfaces |
| Warning | #B45309 | Stale/setup-required warnings only |
| Destructive | #DC2626 | Destructive actions only; none planned in Phase 1 UI |

Accent reserved for:
- Primary `Open booking` action.
- Active focus outline.
- Current/selected day emphasis if such a state exists.
- Small hero/court line accents.

Pickleball green reserved for:
- Open availability indicators.
- Interval chip highlight.
- Small sport identity details.

Do not apply accent colors to every link, every heading, or large page backgrounds. Black/white contrast must carry the layout.

---

## Layout Contract

### Page Structure

1. Hero band:
   - Full-width black product hero with venue name, freshness, compact availability summary, and scroll-reactive court/ball visual.
   - On mobile, hero height is 42-52vh and must leave the first availability card partially visible without scrolling on common phone heights.
   - On desktop, hero height is 52-64vh and must leave the next section visible.

2. Availability section:
   - White/light section with constrained inner width.
   - Mobile uses one-column day cards.
   - Desktop uses one centered column up to 760px, or a two-column card grid only if interval chips remain easy to scan.

3. Footer note:
   - Small read-only explanation: this page shows cached availability last read by the browser extension.

### Card Contract

Each day card must show, in this order:
- Day/date heading.
- Human-readable sublabel if available.
- Total open hours.
- Interval chips.
- `Open booking` action.

Cards must not nest inside decorative cards. Each repeated day is a card; page sections are bands or unframed layouts.

### Data Density

The UI must remain useful when there are 0, 1, 4, or 8 loaded days. Long interval lists wrap inside the card with consistent chip gaps.

---

## Responsiveness

| Breakpoint | Contract |
|------------|----------|
| 320-479px | Single column, 16px card padding, full-width Open booking button, chips wrap at natural widths. |
| 480-767px | Single column, 20-24px page padding, action may sit inline only if it does not squeeze text. |
| 768-1023px | Centered content, hero text and visual can share space but availability preview remains visible. |
| 1024px+ | Hero may use wider composition; availability cards stay scan-friendly and do not stretch beyond comfortable reading width. |

Mobile-first readability is non-negotiable. At 360px width, venue name, last read freshness, day cards, interval chips, and Open booking actions must all be legible without horizontal scrolling.

---

## Interaction And Motion

| Interaction | Contract |
|-------------|----------|
| Hero scroll reaction | Court/ball scene may respond to scroll with subtle translation, rotation, or parallax. It must not cover cards or delay access to availability. |
| Loading | Use skeleton or quiet loading text for display data. No spinner-only full-page state longer than initial fetch. |
| Day cards | Cards may fade/slide in once. No repeated bouncing, shaking, or attention loops. |
| Interval chips | Static by default. Hover/focus may increase contrast only. |
| Open booking | Opens booking URL for that day in a new tab/window using backend-provided safe booking link/date marker. No automated booking steps. |
| Reduced motion | `prefers-reduced-motion: reduce` disables non-essential animation and canvas parallax. |

Motion libraries are optional. GSAP, Framer Motion, Three.js, or React Three Fiber may be used only if bundle cost and mobile behavior are verified. Availability must remain usable if canvas fails or JavaScript animation is disabled.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | Open booking |
| Hero kicker | Cached court availability |
| Freshness label | Last read {formattedDateTime} |
| Freshness fallback | Cached availability |
| Empty state heading | No cached availability yet |
| Empty state body | Refresh ProPickle from the extension, then reopen this page. |
| No days heading | No booking days found |
| No days body | The latest read did not include visible booking days. Try a manual refresh after the booking page has loaded. |
| Error state | We could not load this share page. Check the link or try the stable fallback page. |
| Stale warning | This is an older read. Open booking to confirm live availability before making plans. |
| Footer note | Read-only page. Availability comes from the latest browser-extension read. |
| Destructive confirmation | none - Phase 1 has no destructive UI actions |

Do not imply live availability. Use `Last read`, not `Live now`, `Real-time`, or `Guaranteed`.

---

## Empty, Loading, Error, And Stale States

| State | Visual Contract | Interaction Contract |
|-------|-----------------|----------------------|
| Loading | Black hero shell with stable reserved height; light skeleton cards below. | Fetch public display data once. Do not scrape, poll aggressively, or call sync routes. |
| Empty cache | Clear empty state in first card position. | Tell user to refresh from extension. Do not offer in-page refresh that scrapes. |
| No intervals for a day | Show the day card with `No open intervals` in muted text. | Keep Open booking available if a safe booking URL exists. |
| Invalid/expired share token | Show concise error and link/mention stable fallback if available. | No retry loop beyond normal user refresh. |
| Backend unavailable | Show error with fallback route guidance. | Do not expose raw error details or secrets. |
| Stale data | Show warning near freshness. | Open booking remains the path to confirm live availability. |

---

## Accessibility

- Minimum text contrast: 4.5:1 for normal text, 3:1 for large display text and non-text UI indicators.
- Keyboard users must be able to tab to every `Open booking` action with a visible electric-blue focus ring.
- Hero canvas/3D scene must be decorative with `aria-hidden="true"` or have a concise label only if it conveys meaningful status.
- Do not put essential availability data only inside canvas, images, color, or animation.
- Use semantic structure: one `h1` for venue, `section` per availability day, `h2` per day card, real links for booking actions.
- Respect `prefers-reduced-motion`.
- Ensure touch targets are at least 44px high and separated by at least 8px.

---

## Data And Architecture Contract

| Area | Contract |
|------|----------|
| App location | Create a separate `web/` Next.js TypeScript app alongside `extension/` and `server/`. |
| Current fallback | Keep `GET /s/:shareToken/:venueId` server-rendered HTML stable during Phase 1. |
| Data source | New UI reads cached backend display data only. It must not scrape, open booking widgets, call Supabase directly, or use sync secrets. |
| Future endpoint | Prefer a safe public display endpoint shaped like `GET /api/public/:shareToken/:venueId`. |
| Endpoint behavior | Validate same share token model as existing share page; return display-safe venue, freshness, days, interval labels, hours, booking action URLs, and theme metadata. |
| Raw data | Do not expose raw slot JSON, backend internals, Supabase details, sync tokens, or extension storage keys. |
| Booking action | Open external booking page/day marker only. No login, payment, checkout, reservation, or player automation. |
| Theme data | ProPickle theme should be a typed object, not hard-coded into page rendering branches. |

Public display data minimum shape:

```ts
type PublicVenueAvailability = {
  venueId: string;
  venueName: string;
  lastReadAt: string | null;
  freshnessLabel: string;
  theme: VenueTheme;
  days: Array<{
    date: string;
    title?: string;
    remainingHours: number;
    openIntervals: Array<{ startTime: string; endTime: string; label: string }>;
    bookingUrl?: string;
  }>;
};
```

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party registries | none | not applicable |

No third-party registry blocks are approved by this contract. If the executor later adds shadcn or registry blocks, they must be vetted before use.

---

## Implementation Notes

- Build the polished UI as `web/`, not by replacing `server/src/sharePage.js` in the first pass.
- The backend may add a display-safe public JSON endpoint, but the existing HTML share page remains available as fallback.
- Share page semantics from `server/src/sharePage.js` are the baseline: venue name, last updated, day cards, interval chips, and Open booking links.
- Prefer CSS modules, plain CSS, or Tailwind only if introduced consistently in `web/`; do not retrofit Tailwind into extension/backend during Phase 1.
- Keep extension CSS and popup behavior untouched unless a backend display-data requirement forces a narrow change.
- If using canvas/3D, verify nonblank rendering on mobile and desktop and provide a static fallback.
- Do not create a generic landing page. The first screen is the ProPickle availability experience.

---

## Acceptance Checks

- [ ] `web/` Next.js TypeScript app exists and runs alongside the current backend.
- [ ] Current `/s/:shareToken/:venueId` route still renders as stable fallback.
- [ ] New UI reads cached display data only, preferably through `GET /api/public/:shareToken/:venueId`.
- [ ] No scraping, booking, payment, login, waiver, CAPTCHA, access-control, or Supabase-secret logic exists in `web/`.
- [ ] Mobile 360px view shows venue name, freshness, at least part of availability content, interval chips, and Open booking actions without horizontal scroll.
- [ ] ProPickle theme uses black/white base with electric blue and pickleball green reserved as specified.
- [ ] Venue theme values are separated from rendering logic.
- [ ] Hero motion is optional, tasteful, and disabled or simplified under reduced-motion settings.
- [ ] Empty, loading, error, no-interval, and stale states render with the copy in this contract.
- [ ] Open booking actions are real links, keyboard reachable, and do not automate booking.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved by gsd-ui-checker on 2026-07-02
