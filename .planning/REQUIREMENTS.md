# Requirements: Pickleball Availability Buddy

**Defined:** 2026-06-30
**Core Value:** Show trustworthy open booking intervals quickly without manually clicking every booking day.

## v1 Requirements

### Venue Viewing

- [x] **VIEW-01**: User can open a phone-friendly availability page for a venue from a secret share link.
- [x] **VIEW-02**: User can see one section per available booking day with merged open intervals.
- [x] **VIEW-03**: User can see when the cached availability was last read.
- [x] **VIEW-04**: User can open the booking page for a specific day from that day's availability card.

### Venue Theming

- [ ] **THEME-01**: ProPickle availability page uses ProPickle-style brand cues without reducing readability.
- [x] **THEME-02**: Venue styles are configured as theme data, not hard-coded per page.
- [ ] **THEME-03**: Page transitions and motion are smooth but non-essential, so availability remains usable if animation is unavailable.

### Multi-Venue Support

- [ ] **VENUE-01**: Developer can add a Playbypoint-compatible venue through venue configuration.
- [ ] **VENUE-02**: Each venue keeps separate extension storage, backend cache, share link, booking URL, and theme.
- [ ] **VENUE-03**: User can switch venues in the extension popup without overwriting another venue's cached availability.

### Refresh And Cache

- [ ] **CACHE-01**: Extension popup shows saved availability without auto-refreshing on open.
- [ ] **CACHE-02**: User can manually refresh a selected venue from the popup.
- [ ] **CACHE-03**: User can manually read the current compatible page from the popup.
- [ ] **CACHE-04**: Backend share pages render cached data only and do not initiate scraping.

### Bot Readiness

- [ ] **BOT-01**: Backend keeps availability formatting reusable across share page text, future bot replies, and tests.
- [ ] **BOT-02**: Future bot integrations can answer from cached venue availability without introducing a bot-specific data model.

## v2 Requirements

### Automation

- **AUTO-01**: User can trigger a low-frequency "refresh all venues" flow from the extension.
- **AUTO-02**: User can optionally schedule polite refreshes while Chrome is available and authenticated.

### Bot Delivery

- **MSG-01**: User can ask a Messenger or Telegram bot for latest cached availability by venue.
- **MSG-02**: Bot responses include last-read freshness and venue-specific interval summaries.

### Product Polish

- **WEB-01**: Public availability UI can be deployed as a separate Next.js TypeScript app if server-rendered HTML becomes too limiting.
- **WEB-02**: Portfolio can showcase/link to this project after the user-facing availability page feels polished.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Booking automation | Read-only safety boundary |
| Payment or checkout automation | High-risk and outside the project's purpose |
| Login or waiver automation | Would handle credentials/access controls; user must do this manually |
| Cloudflare/CAPTCHA bypass | Not allowed and unnecessary for user-session based reads |
| Public raw cache JSON | Share pages should summarize data, not expose implementation payloads |
| High-frequency scraping | Availability should be refreshed politely and intentionally |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIEW-01 | Phase 1 | Complete |
| VIEW-02 | Phase 1 | Complete |
| VIEW-03 | Phase 1 | Complete |
| VIEW-04 | Phase 1 | Complete |
| THEME-01 | Phase 1 | Pending |
| THEME-02 | Phase 1 | Complete |
| THEME-03 | Phase 1 | Pending |
| VENUE-01 | Phase 2 | Pending |
| VENUE-02 | Phase 2 | Pending |
| VENUE-03 | Phase 2 | Pending |
| CACHE-01 | Phase 3 | Pending |
| CACHE-02 | Phase 3 | Pending |
| CACHE-03 | Phase 3 | Pending |
| CACHE-04 | Phase 3 | Pending |
| BOT-01 | Phase 4 | Pending |
| BOT-02 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-06-30*
*Last updated: 2026-06-30 after GSD initialization from current repo state*
