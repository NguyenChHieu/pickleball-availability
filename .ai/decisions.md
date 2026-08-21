# Decisions

ADR-lite log for architecture, product, and workflow decisions.

## Template

### YYYY-MM-DD — Decision title

- Context:
- Decision:
- Alternatives considered:
- Consequences:
- Revisit when:

## Log

### 2026-08-20 — Supabase-backed rate limiting for planner event creation

- Context: The planner's event-creation route had no rate limit. Vercel runs multiple serverless instances, so any limiter needs to work across instances, not just within one process.
- Decision: Added `planner_event_creation_attempts` + a `planner_event_creation_check_and_record(p_attempt_key)` `security definer` RPC (row-locked, atomic check-and-record), mirroring the existing `planner_recovery_*` pattern. Client identified via `x-forwarded-for`/`x-real-ip` (best-effort, not authentication-grade).
- Alternatives considered: In-memory limiter (per-instance Map/counter) — rejected because it resets on cold start and doesn't share state across concurrent serverless instances, so it wouldn't actually bound abuse in production.
- Consequences: One more Supabase RPC and table to maintain; rate limiting now depends on Supabase being reachable (fails closed to "allowed" in local-file-mode, per `plannerStore.ts`'s fallback).
- Revisit when: If Supabase RPC latency becomes a measurable bottleneck on the write path, or if a non-Supabase deployment target is added.

### 2026-08-20/21 — Full ES module conversion for the extension's background.js split

- Context: `background.js` had grown to 1049 lines covering tab reading, reader-window lifecycle, pending-refresh retries, and the refresh job engine, all as one file with shared top-level mutable state. It needed splitting, but MV3 service workers support real ES modules (`"type": "module"` in the manifest).
- Decision: Converted `background.js` to a real ES module and split it into 4 seam modules (`tabReader.js`, `readerWindow.js`, `pendingRefresh.js`, `refreshJob.js`) plus the earlier `sync.js` extraction, using real `import`/`export` throughout. Traced every cross-function call exhaustively before writing code, which corrected an earlier (wrong, memory-based) assumption that the split wasn't safe without a shared-state module — the real graph is a clean DAG except one genuine cycle (`readerWindow.js` ↔ `pendingRefresh.js`), verified safe via an isolated Node repro of ESM live bindings (both sides are event-driven callbacks, neither calls the other during module evaluation).
- Alternatives considered: Classic `importScripts()` with shared globals — rejected because it keeps the exact shared-global-soup problem the split was meant to fix, and gives no static way to see which file actually needs which name (this turned out to matter: it's what let two, later three, missing-import bugs ship silently past `node --check`).
- Consequences: More files to navigate; real import/export gives a static (if not fully automated) way to audit cross-file dependencies. Bugs class discovered along the way: a missing import referenced only inside a function body is invisible to `node --check` and to a concatenated/mocked test harness (everything shares one scope there) — caught 3 real instances total (2 during the split, 1 more via live manual QA after). Each got a functional regression test in `extension/tests/esmImports.test.js` that calls the actual function through a real `import()`, proven by revert-and-verify.
- Revisit when: If a 5th seam emerges (background.js is down to ~143 lines now, unlikely soon), or if another missing-import bug of this class surfaces — worth then deciding whether to adopt a real linter (`eslint` with `no-undef` + browser/chrome globals) for `extension/` instead of the ad hoc audit script used this round.
