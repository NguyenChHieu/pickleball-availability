---
phase: 1
slug: venue-themed-availability-ui
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-02
---

# Phase 1 - Validation Strategy

Per-phase validation contract for the venue-themed availability UI.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` for backend; Next.js lint/build/typecheck for web; browser smoke checks for final UI |
| **Config file** | `server/package.json`, `web/package.json` after Plan 02 |
| **Quick run command** | `npm.cmd --prefix server run check` |
| **Full suite command** | `npm.cmd --prefix server run check && npm.cmd --prefix server run test:public && npm.cmd --prefix web run lint && npm.cmd --prefix web run build` |
| **Estimated runtime** | ~90 seconds after web dependencies are installed |

## Sampling Rate

- **After every task commit:** Run the task's listed `<automated>` command.
- **After every plan wave:** Run all commands available for artifacts created so far.
- **Before `$gsd-verify-work`:** Backend check, backend public DTO tests, web lint, web build, and browser smoke checks must be green.
- **Max feedback latency:** 120 seconds for automated checks, excluding first-time npm install.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | VIEW-01, VIEW-02, VIEW-03, VIEW-04 | T-01-01 / T-01-02 / T-01-03 | Public DTO contract rejects unsafe links and leaks no raw cache data | unit | `npm.cmd --prefix server run test:public` | yes after task | pending |
| 01-01-02 | 01 | 1 | VIEW-01, VIEW-02, VIEW-03, VIEW-04, THEME-02 | T-01-02 / T-01-03 | Allowlisted DTO and shared booking URL helpers preserve fallback page behavior | unit + syntax | `npm.cmd --prefix server run test:public && npm.cmd --prefix server run check` | yes after task | pending |
| 01-01-03 | 01 | 1 | VIEW-01, VIEW-03 | T-01-01 / T-01-05 / T-01-06 | `/api/public` validates token before cache lookup and returns safe 404/500 bodies | unit + syntax + source gate | `npm.cmd --prefix server run check && npm.cmd --prefix server run test:public` | yes after task | pending |
| 01-02-01 | 02 | 2 | VIEW-01, THEME-01, THEME-02, THEME-03 | T-01-SC / T-01-10 | `web/` scaffold contains no secrets and only approved direct packages | lint + typecheck | `npm.cmd --prefix web run typecheck && npm.cmd --prefix web run lint` | yes after task | pending |
| 01-03-01 | 03 | 3 | VIEW-01, VIEW-03 | T-01-07 / T-01-10 / T-01-11 | Web route fetches only `/api/public` and sends no sync tokens or scraping calls | lint + source gate | `npm.cmd --prefix web run typecheck && npm.cmd --prefix web run lint` | yes after task | pending |
| 01-03-02 | 03 | 3 | VIEW-01, VIEW-02, VIEW-03, VIEW-04, THEME-01, THEME-02 | T-01-08 / T-01-12 | Semantic cards render display DTO, stale/empty states, and plain external booking links only | build + source gate | `npm.cmd --prefix web run typecheck && npm.cmd --prefix web run lint && npm.cmd --prefix web run build` | yes after task | pending |
| 01-04-01 | 04 | 4 | THEME-01, THEME-03 | T-01-14 / T-01-17 | Hero motion is decorative, package-free, and reduced-motion safe | lint + source gate | `npm.cmd --prefix web run typecheck && npm.cmd --prefix web run lint` | yes after task | pending |
| 01-04-02 | 04 | 4 | VIEW-01, VIEW-02, VIEW-03, VIEW-04, THEME-01, THEME-02, THEME-03 | T-01-13 / T-01-16 / T-01-18 | Responsive states remain read-only and do not imply live availability | build | `npm.cmd --prefix web run typecheck && npm.cmd --prefix web run lint && npm.cmd --prefix web run build` | yes after task | pending |
| 01-04-03 | 04 | 4 | VIEW-01, VIEW-02, VIEW-03, VIEW-04, THEME-03 | T-01-13 / T-01-17 / T-01-18 | Browser checks prove ready/stale/empty/wrong-token/reduced-motion states | browser | Browser checks at 1440x900, 390x844, and 360px | manual evidence | pending |

## Wave 0 Requirements

Existing infrastructure covers the phase before execution starts:

- `server/package.json` already provides `npm.cmd --prefix server run check`.
- Plan 01 Task 1 adds `server/test/publicAvailability.test.js` before backend implementation work.
- Plan 02 Task 1 creates `web/package.json` scripts before route/component work.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Desktop/mobile visual layout | VIEW-01, VIEW-02, THEME-01 | Text wrapping, overlap, and first-viewport composition require browser observation | Open `/s/dev-share/propickle` at 1440x900, 390x844, and 360px and record observations in `01-04-SUMMARY.md`. |
| Reduced-motion behavior | THEME-03 | Browser media emulation is needed to prove optional motion stops | Enable reduced-motion emulation and confirm hero movement stops while semantic availability content remains visible. |
| External booking link behavior | VIEW-04 | It is intentionally a navigation action, not an automated booking flow | Inspect links and click one manually; confirm it opens a normal booking URL/day marker only. |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or explicit browser verification.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing test infrastructure references.
- [x] No watch-mode flags.
- [x] Feedback latency target is under 120 seconds after install.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-07-02
