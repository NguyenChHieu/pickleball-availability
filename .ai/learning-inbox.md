# Learning Inbox

Use this for proposed changes to prompts, skills, hooks, subagents, or project notes. Do not auto-promote without human approval.

## Proposed Improvements

| Date | Source/session | Problem observed | Frequency | Proposed destination | Proposed change | Risk | Approved? |
|---|---|---:|---:|---|---|---|---|
| 2026-07-08 | Refresh UX / share page sessions | `next build` repeatedly hits local Windows EPERM on `.next/trace*` unless rerun with elevated filesystem access. | 3+ | PROJECT NOTES | Add a short local validation note: if `npm.cmd --prefix web run build` fails with EPERM on `.next/trace*`, rerun the same build with approved filesystem access; do not treat it as a code failure. | Low; repo-specific Windows workflow note only. | Promoted to project notes |
| 2026-07-08 | Extension refresh UX sessions | Many extension fixes require the same manual validation loop: reload unpacked extension, refresh selected venues, then verify popup/share page. | 3+ | HOOKS / SKILLS | Create a small release checklist or skill for extension changes: syntax checks, manifest JSON, reload extension, run one selected refresh, verify share page update. | Medium; manual steps cannot be fully automated, but checklist reduces missed QA. | Promoted to repo playbook |
| 2026-07-08 | Venue-themed share UI sessions | Header/layout bugs appeared at laptop widths, not just mobile; WOTSO long name clipped around desktop/tablet widths. | 2 | PROJECT NOTES | Add share-page visual QA guidance: check long venue names at 1440, 1366, 1200, 967, 768, and mobile before shipping header/nav changes. | Low; validation guidance only. | Promoted to project notes |

## Parking Lot

- Product idea: when2meet-style pickleball planner. Users have accounts with venue preferences and preferred hours; friends mark availability; the app intersects group free time with venue availability/cache to suggest matching venues and slots.
