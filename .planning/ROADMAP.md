# Roadmap: Pickleball Availability Buddy

## Milestone: Multi-Venue Polished Availability

### Phase 1: Venue-Themed Availability UI

**Goal:** Build a more polished ProPickle availability page with venue-specific styling while preserving the current cached-read architecture.
**Mode:** mvp
**UI hint:** yes

**Requirements:** VIEW-01, VIEW-02, VIEW-03, VIEW-04, THEME-01, THEME-02, THEME-03

**Success Criteria:**
1. ProPickle share page clearly shows venue name, last-read freshness, days, interval chips, and open booking actions.
2. ProPickle styling uses black, white, blue, and pickleball-green brand cues in a modern but readable way.
3. Venue theme data is separated from the rendering logic so future venues can supply their own theme.
4. Motion is tasteful and optional; the page remains usable without animation.
5. The page still renders only cached backend availability and never triggers scraping.

### Phase 2: Second Venue Integration

**Goal:** Prove the venue/provider model by adding at least one more Playbypoint-compatible venue.
**Mode:** mvp

**Requirements:** VENUE-01, VENUE-02, VENUE-03

**Success Criteria:**
1. Broadway Pickleball or North Ryde can be added through venue configuration with minimal provider changes.
2. Extension popup can switch between ProPickle and the new venue.
3. Backend stores and serves separate cached payloads by venue ID.
4. Share links for each venue render the correct venue name, theme, intervals, and booking URL.

### Phase 3: Refresh Flow Polish

**Goal:** Make manual refresh and cache freshness obvious for multiple venues.
**Mode:** mvp

**Requirements:** CACHE-01, CACHE-02, CACHE-03, CACHE-04

**Success Criteria:**
1. Popup never refreshes unexpectedly on open.
2. Popup clearly distinguishes saved, refreshing, synced, failed, and setup-required states.
3. Share page freshness is visible enough that stale data is not mistaken for live data.
4. Refresh failures preserve the last saved result and explain what the user can do next.

### Phase 4: Bot-Ready Formatter Layer

**Goal:** Keep future Messenger or Telegram replies aligned with the share page by sharing cache and formatting logic.
**Mode:** mvp

**Requirements:** BOT-01, BOT-02

**Success Criteria:**
1. Cached payload can produce both HTML cards and bot-style text summaries.
2. Formatter output includes venue name, last-read freshness, day labels, and open intervals.
3. Bot integration can remain delivery-only; it does not scrape or own a separate data model.
4. Messenger/Telegram can be added later without changing extension payload shape.

## Deferred Ideas

- Add a separate `web/` Next.js TypeScript app if the themed share page outgrows server-rendered HTML.
- Add GSAP for subtle page/card transitions after the page layout and theme model are stable.
- Add Three.js or React Three Fiber only if it serves a real brand moment; avoid making availability harder to inspect.
- Add low-frequency refresh-all only after at least two venues work.

---
*Roadmap created: 2026-06-30 after GSD initialization from current repo state*
