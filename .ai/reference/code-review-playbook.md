# Google Engineering Practices: Code Review Playbook

This file distills Google's public `eng-practices` code review guidance into agent-friendly working rules. Use it when reviewing PRs, preparing changes for review, or deciding whether code is ready to approve.

Source: https://github.com/google/eng-practices

## Core Principle

Optimize for long-term code health while keeping the team moving.

Approve a change when it definitely improves the overall health of the system, even if it is not perfect. Do not block on tiny polish items. Do block changes that make the system less maintainable, less tested, more complex, or harder for future developers to understand.

Exceptions are rare and should be treated as real emergencies: serious production impact, major security issue, legal issue, or hard external deadline where failure would be disastrous.

## Reviewer Priorities

Review in this order:

1. Does the change make sense at all?
2. Is the design appropriate for this system?
3. Does it behave correctly for users and future developers?
4. Is it simpler than the alternatives?
5. Are tests meaningful and likely to fail for real regressions?
6. Are names, comments, style, and docs clear enough for future maintainers?
7. Does the whole change improve code health?

Always inspect enough surrounding context to understand the change. Do not approve human-written code you do not understand. If the code is too hard to understand, ask for clarification in the code itself, not just in a PR comment.

## What To Look For

Design:
- Check whether the change belongs in this system or should live elsewhere.
- Prefer solutions that fit existing architecture and reduce future maintenance cost.
- Reject unnecessary generalization and speculative future-proofing.

Functionality:
- Think like both an end user and a future developer using the code.
- Look for edge cases, error paths, data-shape mismatches, concurrency risks, and user-facing regressions.
- For UI or visible behavior, ask for a demo or run the app when reading code is not enough.

Complexity:
- Push back when code is hard to understand quickly.
- Prefer solving the known problem now over building for guessed future requirements.
- Do not accept complexity just because it is hidden in tests or helpers.

Tests:
- Production logic changes should include related tests unless this is a true emergency.
- Tests should be simple, useful, and capable of failing when behavior is broken.
- Check for weak assertions, false positives, over-mocked behavior, missing edge cases, and unreadable test setup.

Naming and comments:
- Names should communicate purpose without being vague or excessively long.
- Comments should mostly explain why, not restate what the code does.
- If a reviewer needs an explanation, first prefer clearer code; then add a code comment only if the reasoning cannot live naturally in code.

Style and documentation:
- Follow the project's style guide and local conventions.
- Do not block on personal style preferences.
- Mark minor style/polish as `Nit:` or `Optional:`.
- If behavior, setup, usage, build, release, or API expectations changed, docs should change too.

## Review Flow

Start broad:
- Read the PR/CL description.
- Check whether the change should exist.
- If the direction is wrong, say so early and explain the better path.

Then inspect the main files:
- Find the central implementation files first.
- Send major design feedback immediately if it would invalidate the rest of the diff.
- Then review remaining files in a logical order.

Use tests as a map:
- Reading tests first can reveal intended behavior.
- If tests do not explain the intended behavior, the PR likely needs better tests or description.

For large PRs:
- Ask for a split when the change is too large to review well.
- Prefer one self-contained change per PR.
- Refactors should usually be separate from feature or bug-fix changes.

## Comment Style

Be kind, direct, and technical.

Good comments:
- Discuss the code, not the person.
- Explain the reason behind the request.
- Distinguish required fixes from suggestions.
- Give enough direction to unblock the author without designing everything for them.
- Praise good decisions when they improve quality or teach something useful.

Use severity labels:
- `Required:` must be fixed before approval.
- `Nit:` minor polish; should not block approval.
- `Optional:` worth considering, but not required.
- `FYI:` useful future context, not action required.

Do not let review-tool explanations replace code clarity. If a future reader needs the explanation, the code, tests, docs, or comments should carry it.

## Handling Pushback

When the author disagrees:
- First ask whether they may be right; they may know the code better.
- Prefer technical facts, user impact, maintainability, tests, and style guides over opinion.
- If the author's argument is sound, drop the issue.
- If the issue still matters, explain why the requested change improves code health.

Do not accept "I'll clean it up later" when the current change introduces new complexity or debt. Cleanup that matters should usually happen before merge. If the cleanup is unrelated or pre-existing, ask for a tracked follow-up.

If consensus stalls:
- Move to a short synchronous discussion.
- Record the outcome back on the PR.
- Escalate to a maintainer, tech lead, or manager rather than letting the PR sit indefinitely.

## Author Rules

Prepare PRs so they are easy to review.

PR description:
- First line should summarize what the change does.
- Body should explain why the change exists, relevant context, tradeoffs, risks, bugs, benchmarks, or design links.
- Avoid vague descriptions like "fix bug", "cleanup", "phase 1", or "add patch".
- Before merge, update the description if the PR changed during review.

PR size:
- Prefer small, self-contained changes.
- Include related tests in the same PR.
- Split refactors from behavior changes when possible.
- A PR is too large when the reviewer cannot reason about it confidently.

Responding to comments:
- Do not take comments personally.
- If a reviewer does not understand something, clarify the code first.
- If you disagree, explain tradeoffs and ask what standard or risk the reviewer is optimizing for.
- Never respond in anger; review comments become permanent history.

## Agent Behavior

When acting as a code-review or implementation agent:

- Inspect the real diff and relevant surrounding files before giving conclusions.
- Lead with blocking findings, ordered by severity.
- Keep line references tight.
- Separate required fixes from nits and optional improvements.
- Do not claim tests pass unless they were run.
- If tests cannot be run, say exactly why.
- Do not invent missing requirements or overfit to personal taste.
- Do not approve changes that degrade code health.
- Do not demand perfection when the change is clearly a net improvement.
- Preserve unrelated user changes.
- Prefer focused fixes and focused verification.

Suggested review output:

```markdown
## Findings
- [P1] Required: ...
- [P2] Required: ...
- [Nit] Optional: ...

## Tests / Verification
- Ran: ...
- Not run: ... because ...

## Approval Judgment
LGTM / Not ready / Ready after nits, with reason.
```

## Emergency Policy

Speed can outweigh normal thoroughness only for true emergencies: major production impact, security hole, legal issue, launch blocker with hard external consequences, or similarly severe situations.

Soft deadlines, Friday timing, personal urgency, long-running feature work, or reviewer time-zone inconvenience are not emergencies.

After an emergency change lands, schedule or perform a deeper follow-up review so temporary shortcuts do not become permanent debt.
