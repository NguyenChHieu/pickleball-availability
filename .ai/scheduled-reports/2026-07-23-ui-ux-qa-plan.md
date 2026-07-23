# Comprehensive UI/UX QA Plan - 2026-07-23

## Goal

Validate every user-facing extension and web surface as one coherent product, catch responsive and state regressions before merge, and maximize usability without turning the extension into a second visual web app.

For design-heavy changes:

- Stitch/Figma is the visual source of truth.
- A design reviewer handles visual critique and interaction reasoning when needed.
- Codex implements mechanical fixes, responsive behavior, accessibility, and tests.
- Ponytail reviews complexity before release.

## Current Evidence

- Production screenshots captured at `1440x900` and `390x844` for `/`, `/app`, and `/planner/new`.
- Lighthouse accessibility: homepage `100`, dashboard `96`, planner creation `100`.
- Lighthouse best practices: `96` on all three routes.
- Extension automated QA: 13 scripts passed `node --check`, manifest JSON passed, and all 16 current reader/window/continuity tests passed.
- Static popup and options screenshots were captured. They validate layout only; real extension state still requires Chrome.

## Suspicious Areas

### Required Mechanical Fixes

1. Dashboard connection status uses `aria-label` on a `div` without a valid role. Lighthouse reports `aria-prohibited-attr`.
2. The homepage and dashboard brand links have visible-label/accessibility-name mismatches.
3. `/favicon.ico` returns `404` on every audited route, producing a console error and lowering best-practices scores.

### Required Runtime Verification

4. Dashboard screenshots only cover disconnected cached mode. Reload the unpacked extension and verify connected refresh, progress, partial failure, setup-required, completion, and live cache update.
5. Share pages were not visually rechecked in this pass because production links require the real secret token. Recheck all six venue themes with real copied availability links.
6. Planner event pages need populated-state QA: no participants, one participant, several participants, overlap heatmap, no venue cache, stale cache, venue matches, recovery, and rate-limit errors.

### High-Value UX Review

7. `/planner/new` has no visible route back to Home or Dashboard. It currently feels like a dead-end form before event creation.
8. Homepage venues use an internal scroll region, but the remaining venues are not strongly discoverable, especially on mobile where only the first cards are visible in a full-page screenshot.
9. Planner venue choices are dense on mobile. Long all-caps platform descriptions compete with venue names and make six-venue selection slower to scan.
10. Dashboard venue checkboxes expose only a `26x26` click target. Increase the interactive label area or make a safe selection region meet the `44x44` touch target without stealing the booking link.
11. The mobile dashboard `Create group planner` action reads like a small underlined text link rather than a primary workflow action. Verify tap target and hierarchy.
12. The extension popup is visually clear but much softer and more card-heavy than the Kinetic Grid web surfaces. Decide in Stitch whether to tighten typography, radii, and status treatment while keeping popup density appropriate.
13. Homepage, dashboard, planner, share pages, popup, and options currently have separate scrollbar treatments. Verify each is intentional and visible against its surface theme.

## Surface Matrix

| Surface | States to verify | Critical interactions |
|---|---|---|
| Extension popup | first load, saved cache, no cache, search, 3+ venues, selected venues, loading, success, partial failure, setup required, history open, More actions open | select venue, refresh selected/stale/all confirmation, setup window, deep scan warning, copy/open links, planner launch |
| Extension options | defaults, saved values, invalid URLs, missing tokens, save success/failure | keyboard order, password fields, clear validation, no accidental secret disclosure |
| Homepage `/` | dark/light, fresh/stale venue data, Three.js available/unavailable, reduced motion | navigation, theme persistence, CTAs, venue internal scroll, planner links |
| Dashboard `/app` | cached disconnected, checking, connected, active refresh, partial failure, setup required, no cache, no search results | search, selection ordering, scroll, stale/selected refresh, progress, history, booking links |
| Share page `/s/.../:venue` | six venue themes, fresh/stale/empty/error/loading, any-court/same-court tabs, long venue names | venue menu, outside click, Escape, refresh bridge, booking/planner links, mobile nav |
| Planner creation `/planner/new` | default, preselected query venues, invalid query, search/no results, expanded list, validation and API failure | dates/times, venue selection, keyboard flow, create and back navigation |
| Planner event `/p/:event` | no participants, one/many participants, recovered identity, heat intensity, no/stale/fresh venue matches | mouse drag, touch tap, keyboard cell toggle, save/recover/forget/password change, tooltip/tap details |
| System states | 404 and loading/error boundaries | understandable recovery path and no dead ends |

## Viewport Matrix

Use representative widths rather than random resizing:

- `1440x900`: primary desktop.
- `1280x800`: common laptop.
- `1024x768`: compact desktop/tablet landscape.
- `820x1180` and `768x1024`: tablet breakpoints around dashboard navigation.
- `390x844` and `360x800`: primary mobile checks.
- `320x568`: stress test for long venue names and dense planner controls.
- Share-page header spot checks at `1366`, `1200`, and `967` because prior clipping appeared between broad breakpoints.

## Interaction And Accessibility Checks

- No page-level horizontal overflow. The planner grid may scroll internally with a visible cue.
- Every action has a visible focus state and meaningful accessible name.
- Touch targets are at least `44x44` where practical.
- Menus close on selection, outside click, and Escape; focus returns to the trigger.
- Search results, selected counts, progress, failures, and completion are announced without excessive live-region noise.
- Disabled controls explain why through adjacent text, not hover-only tooltips.
- Color is not the only indicator of fresh, stale, selected, failed, or available states.
- Text contrast meets WCAG AA in every venue theme and both homepage modes.
- Reduced-motion mode disables Three.js movement, pulse, loaders, hover movement, and animated progress without hiding meaning.
- Keyboard and touch users can inspect heatmap participant names/counts.
- Long venue names wrap without shifting controls, changing card height unexpectedly, or clipping.

## Reliability And Perceived Performance

- Opening popup or dashboard never starts a scrape automatically.
- Cached content renders before extension connection checks finish.
- Refresh activity does not block navigation, search, copy, or viewing saved results.
- Loader insertion does not move nearby controls or cause popup height oscillation.
- Last good cache remains visible after provider failure.
- Three.js hero has a readable fallback and does not delay primary CTA interaction.
- Browser console stays clear of failed resources and uncaught errors.

## Execution Waves

1. **Mechanical baseline:** fix the three Lighthouse defects, rerun Lighthouse, fixtures, typecheck, lint, and build.
2. **Live extension pass:** reload unpacked extension and execute the popup, reader-window, dashboard bridge, and share refresh checks from `.ai/playbooks/extension-qa.md`.
3. **Cross-surface visual pass:** capture the viewport matrix for homepage, dashboard, planner creation/event, all six share themes, popup, and options.
4. **Interaction pass:** keyboard, touch, focus, menus, search, selection ordering, heatmap, refresh states, and error recovery.
5. **Design decision pass:** send only the extension consistency, planner density/navigation, homepage venue-scroll affordance, and dashboard action hierarchy questions through Stitch.
6. **Release gate:** code review, Ponytail, automated validation, Vercel preview, user review, then merge.

## Release Acceptance

- No open P1 or P2 usability/accessibility findings.
- All automated extension and web checks pass.
- One real connected `Refresh Selected` succeeds and updates the dashboard.
- At least one setup-required or controlled failure preserves cached content and offers recovery.
- All six share themes pass long-name and mobile checks.
- Planner creation and event completion work on desktop, mobile, keyboard, and touch.
- Production preview has no console errors, secret leakage, clipped text, incoherent overlap, or unexplained disabled primary action.

## Execution Results

Completed on `codex/ui-ux-qa`:

- Fixed homepage/dashboard accessible-name mismatches, dashboard status semantics, and the missing application icon.
- Added a visible planner-to-dashboard return path and enlarged undersized dashboard/share-page touch targets without adding new controls.
- Corrected Broadway, Sydney Racquet, and WOTSO action/text contrast through shared theme tokens. All six venue share pages now score `100` accessibility and `100` best practices in Lighthouse.
- Verified the share venue picker at desktop and mobile widths: three unselected venues first, current venue last, search filtering, outside-click close, Escape close, and no overflow at `320px`.
- Verified the dashboard keeps six results inside a three-card scroll region, moves selected venues after unselected venues, filters in place, and has no horizontal overflow at `390px`.
- Verified a populated planner event at desktop and mobile widths. The heatmap uses internal horizontal scrolling and does not create page-level overflow.
- Passed 37 web fixtures, typecheck, lint, production build, 13 extension syntax checks, manifest validation, and all 16 extension tests.
- Lighthouse result after fixes: homepage, dashboard, planner creation/event, and all six share themes score `100` accessibility and `100` best practices in the audited categories.

Still required before merge:

- Reload the unpacked extension in a real Chrome profile and complete one connected `Refresh Selected` plus one share-page `Refresh` flow.
- Publish and smoke-test a Vercel branch preview, then request user approval before merging to `main`.

Design-source follow-ups, not blockers for this mechanical QA branch:

- Decide in Stitch whether homepage venue-scroll discoverability needs a stronger affordance.
- Review planner venue-selection density and extension/web visual alignment as a dedicated design pass.
