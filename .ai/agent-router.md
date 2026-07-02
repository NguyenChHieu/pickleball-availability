# Agent Router

This file tells coding agents what workflow, plugin, skill, or state update to use. Keep this file compact and repo-agnostic; put project specifics in `.ai/project-context.md`.

## Lanes

| Lane | Use for | Planning | Validation | State update |
|---|---|---|---|---|
| FAST | explanation, brainstorming, small review, no edits | none or 1-2 bullets | not required | none |
| EXPRESS | narrow edit, usually one or two files | compact approach | focused test/lint/typecheck | worklog if meaningful |
| CONTROLLED | multi-file, risky, architecture, migration, security, release, complex debugging | required | staged + final validation | worklog + decision/error notes when useful |

## Trigger Matrix

| Trigger | Route |
|---|---|
| Multi-file feature | CONTROLLED + GSD plan/execute/verify |
| Migration or architecture decision | CONTROLLED + GSD + decision note |
| Complex bug | CONTROLLED; reproduce before patch; GSD if multi-step |
| Security review/remediation | CONTROLLED; read-only analysis first; narrow fixes |
| One-file bug | EXPRESS; reproduce if possible; focused validation |
| New abstraction/dependency/wrapper | Ponytail review before final |
| Refactor | Ponytail review after behavior-preserving diff |
| Whole-repo simplification | Ponytail audit; human triage before edits |
| PR/code review | Code-review playbook skill/subagent |
| Stitch/Figma/design import | Stitch design-import skill only; implementation must follow `/imported`/`DESIGN.md`, not taste guesses |
| Repeated manual checklist | Propose a skill |
| Repeated specialist role | Propose a subagent |
| Must happen before/after tool use | Propose a hook |
| Time-based recurring report | Propose scheduled task/automation |

## Visual UI Routing

For design-heavy frontend work, do not ask a coding agent—especially Codex—to invent the UI from scratch. Route through Stitch/Figma/design artifacts first, then implement faithfully.

Use this sequence:

1. Stitch/Figma/MCP creates or imports the visual source.
2. Save raw artifacts in `/imported` and/or `DESIGN.md`.
3. Claude/design reviewer may critique tokens, layout, accessibility, and interaction states.
4. Claude or Codex implements against the artifacts with focused validation; Codex should stay implementation-focused.
5. Ponytail reviews implementation complexity before finalizing.

## GSD Usage

Use GSD for delivery work that benefits from phases:

1. discuss / clarify requirements
2. plan phase with success criteria
3. execute scoped changes
4. verify with real checks
5. summarize result and next step

Do not use GSD for tiny edits, explanation-only tasks, or simple one-file fixes.

## Ponytail Usage

Use Ponytail as a complexity brake, not as the main driver.

Run Ponytail review when any of these are true:

- diff introduces abstraction
- diff introduces dependency
- diff introduces wrapper/framework layer
- diff adds large new logic
- user requested refactor
- implementation feels clever or over-generalized
- pre-PR review

Expected Ponytail output:

- deletion opportunities
- simplification opportunities
- unnecessary dependencies/abstractions
- risks of simplification
- concrete recommended changes

## State Update Policy

After meaningful work, append one JSON object to `.ai/worklog/YYYY-MM.jsonl`:

```json
{"date":"YYYY-MM-DD","tool":"claude-code|codex","session_id":"...","lane":"EXPRESS|CONTROLLED","task":"...","category":"feature|bug|refactor|review|security|workflow","plugins":["gsd","ponytail-review"],"files_changed":[],"validation":[],"errors":[],"lessons":[],"next":"..."}
```

Promotion rules:

- One occurrence: worklog only.
- Repeated twice: add to `.ai/learning-inbox.md`.
- Repeated three times or high severity: propose promotion to `CLAUDE.md`, `AGENTS.md`, a skill, a subagent, or a hook.
- Do not silently edit global instructions from session learnings.

## Final Response Contract

For implementation tasks, report:

- lane
- files changed
- validation run / not run
- key risk or limitation
- next step when relevant
