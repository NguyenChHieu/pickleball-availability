# Requirements: Pickleball Availability Buddy

**Reviewed:** 2026-07-13
**Core Value:** Show trustworthy court availability quickly, then help a group find a time and venue that work.

## Delivered Requirements

### Venue Availability

- [x] **VIEW-01**: User can open a phone-friendly venue page from a secret availability link.
- [x] **VIEW-02**: User can inspect merged any-court intervals and same-court continuity where the provider exposes court labels.
- [x] **VIEW-03**: User can see cache freshness and stale state without a share page triggering scraping.
- [x] **VIEW-04**: User can open a read-only booking link for a venue or day.
- [x] **THEME-01**: Each configured venue can supply its own theme and metadata.
- [x] **THEME-02**: Venue switching scales from shared venue definitions rather than pair-specific controls.

### Multi-Venue Extension

- [x] **VENUE-01**: Developer can add a venue through venue configuration plus a provider adapter.
- [x] **VENUE-02**: Each venue keeps separate storage, cache, share link, booking URL, and display metadata.
- [x] **VENUE-03**: User can choose venues and refresh selected, stale, or all venues without overwriting other results.
- [x] **VENUE-04**: Individual failures preserve prior successful results and report per-venue status/timing.
- [x] **VENUE-05**: Normal multi-venue reads run in an unfocused reader window; explicit deep scans may remain serial and visible.

### Cache And Delivery

- [x] **CACHE-01**: Popup loads saved results without refreshing on open.
- [x] **CACHE-02**: Next API accepts token-protected extension syncs and stores latest results durably in Supabase.
- [x] **CACHE-03**: Public pages expose normalized summaries rather than raw cache records or backend secrets.
- [x] **CACHE-04**: Text summaries and Messenger delivery reuse the shared cache payload and formatter.

### Group Planner

- [x] **PLAN-01**: Host can create a secret planner with dates, preferred hours, venues, and minimum duration.
- [x] **PLAN-02**: Participant can mark availability in 30-minute cells and see a continuous group-overlap heatmap.
- [x] **PLAN-03**: Same browser can edit through an opaque local edit token; participant may optionally add a recovery password.
- [x] **PLAN-04**: Another browser can recover by normalized display name and password; failed recovery is durably rate-limited.
- [x] **PLAN-05**: Public planner responses exclude edit tokens and password hashes.
- [x] **PLAN-06**: Venue recommendations use cached any-court intervals and add same-court confidence when available.
- [x] **PLAN-07**: Planner pages never trigger scraping, booking, login, checkout, or payment.

## Current Release Requirements

- [x] **QA-01**: Vercel preview passes event creation, first save, reload edit, forget-device, wrong-password, correct recovery, heatmap, and venue matching smoke tests.
- [x] **QA-02**: Fixtures, typecheck, lint, production build, code review, and simplicity review pass on the planner release branch.
- [ ] **QA-03**: User reviews the preview before the planner release branch merges to `main`.

## Later Requirements

- **AUTO-01**: Public guest-visible venues may receive a polite scheduled refresh with explicit limits and observability.
- **BOT-01**: Telegram or another supported chat channel can answer from cached venue data only.
- **ACCOUNT-01**: Optional accounts can store recurring planner preferences, not booking-site credentials.
- **PROFILE-01**: A user can save preferred venues and preferred playing hours after account value is proven.

## Out Of Scope

| Feature | Reason |
|---------|--------|
| Booking/payment automation | Violates the project's read-only boundary |
| Login/waiver/CAPTCHA bypass | Credentials and access controls remain user-managed |
| Planner-triggered scraping | Planner must remain cache-only and fast |
| Public raw cache data | Public views expose only normalized summaries |
| Mandatory planner accounts | Secret events and optional recovery are sufficient for V1 |

## Traceability

| Area | Primary implementation | Verification |
|------|------------------------|--------------|
| Venue refresh | `extension/background.js`, `extension/refreshOrchestrator.js`, providers | Extension unit tests and manual QA playbook |
| Availability pages | `web/src/components/AvailabilityPage.tsx`, `web/src/server/publicAvailability.ts` | Fixtures, typecheck, build, browser QA |
| Shared formatter | `web/src/server/formatAvailability.ts`, text and Messenger routes | `formatAvailability.test.ts` |
| Planner persistence/security | `web/src/server/plannerStore.ts`, `web/supabase.sql` | Planner store fixtures and deployed recovery QA |
| Planner matching | `web/src/server/plannerMatch.ts` | Planner matching/store fixtures |
| Planner UI | `web/src/components/PlannerNewForm.tsx`, `PlannerEventClient.tsx` | Vercel preview smoke test |

---
*Last updated: 2026-07-13 during planner release QA*
