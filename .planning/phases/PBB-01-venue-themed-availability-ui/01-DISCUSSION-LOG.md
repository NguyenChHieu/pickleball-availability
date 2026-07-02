# Phase 1: Venue-Themed Availability UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 1-Venue-Themed Availability UI
**Areas discussed:** Display Data Endpoint

---

## Display Data Endpoint

### Response Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Display-ready payload | Backend converts raw cache into exactly what the web UI needs: venue name, freshness label, theme identifier, day cards, interval labels, booking URLs. | yes |
| Mostly raw cache plus small metadata | Backend returns cached payload with token validation and maybe theme; web does more formatting. | |
| Two layers | Public display endpoint plus a separate protected/internal raw route. | |

**User's choice:** Display-ready payload.
**Notes:** Backend should keep formatting centralized so the web UI does not duplicate cache-shape logic.

### Theme Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Backend includes theme metadata | API returns full theme colors/copy/booking hints. | |
| Web app owns theme metadata | API returns only availability; web maps theme locally. | |
| Hybrid | Backend returns `themeId`, web maps that to full theme locally. | yes |

**User's choice:** Hybrid.
**Notes:** This keeps visual-heavy GSAP/R3F theme behavior in `web/`, while backend remains display-data focused.

### Failure Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| HTTP status + display-safe body | Wrong token returns `404`; empty cache returns `404` with `state: "empty"`; stale data returns `200` with `isStale: true`. | yes |
| Always 200 with state field | Easier frontend rendering but weaker anti-probing behavior. | |
| Strict HTTP only | Minimal bodies; secure but less frontend state detail. | |

**User's choice:** HTTP status + display-safe body.
**Notes:** Keep wrong-token behavior less discoverable while still giving the web app enough state for legitimate empty/stale/error UI.

### Stale Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| 6 hours | Better for same-day court accuracy, but more warnings. | |
| 12 hours | Balanced warning threshold for same-day sharing. | yes |
| 24 hours | Less noisy but can hide stale availability. | |

**User's choice:** 12 hours.
**Notes:** The UI-SPEC stale warning should appear when cached reads are older than 12 hours.

---

## the agent's Discretion

- Exact TypeScript type names, helper names, and module boundaries may be decided during planning.

## Deferred Ideas

- Web app routing.
- Extension share-link behavior for the polished web page.
- Motion implementation depth.
- Deployment path.
