# Learning Inbox

Use this for proposed changes to prompts, skills, hooks, subagents, or project notes. Do not auto-promote without human approval.

## Proposed Improvements

| Date | Source/session | Problem observed | Frequency | Proposed destination | Proposed change | Risk | Approved? |
|---|---|---:|---:|---|---|---|---|
| 2026-07-08 | Refresh UX / share page sessions | `next build` repeatedly hits local Windows EPERM on `.next/trace*` unless rerun with elevated filesystem access. | 3+ | PROJECT NOTES | Add a short local validation note: if `npm.cmd --prefix web run build` fails with EPERM on `.next/trace*`, rerun the same build with approved filesystem access; do not treat it as a code failure. | Low; repo-specific Windows workflow note only. | Promoted to project notes |
| 2026-07-08 | Extension refresh UX sessions | Many extension fixes require the same manual validation loop: reload unpacked extension, refresh selected venues, then verify popup/share page. | 3+ | HOOKS / SKILLS | Create a small release checklist or skill for extension changes: syntax checks, manifest JSON, reload extension, run one selected refresh, verify share page update. | Medium; manual steps cannot be fully automated, but checklist reduces missed QA. | Promoted to repo playbook |
| 2026-07-08 | Venue-themed share UI sessions | Header/layout bugs appeared at laptop widths, not just mobile; WOTSO long name clipped around desktop/tablet widths. | 2 | PROJECT NOTES | Add share-page visual QA guidance: check long venue names at 1440, 1366, 1200, 967, 768, and mobile before shipping header/nav changes. | Low; validation guidance only. | Promoted to project notes |
| 2026-07-23 | Planner, venue picker, and dashboard release sessions | UI regressions repeatedly appeared outside the initially checked surface or viewport: clipped mobile menus, incorrect filtered counts, a malformed status indicator, and fixed-canvas dashboard assumptions. | 3+ | HOOKS / SKILLS | Add a repo UI release playbook covering extension popup/options, homepage, dashboard, share pages, planner creation/event pages, interaction states, accessibility, and representative desktop/tablet/mobile widths. Require it before merging visual changes. | Medium; the checklist must stay risk-based so small non-visual changes are not burdened. | Proposed |
| 2026-07-23 | Post-merge project state | `.ai/project-context.md` and `.planning/` still describe merged feature branches and completed preview gates after `main` is already deployed. | 2 | HOOKS / PROJECT NOTES | Add a post-merge reconciliation check that compares the current branch/release status with project context, requirements, and roadmap, then proposes narrow documentation updates. | Low; documentation-only and should not rewrite active plans automatically. | Proposed |

## Parking Lot

- Product idea: when2meet-style pickleball planner. Users have accounts with venue preferences and preferred hours; friends mark availability; the app intersects group free time with venue availability/cache to suggest matching venues and slots.
