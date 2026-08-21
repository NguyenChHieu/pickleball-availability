# Durable Lessons

Only promote lessons here after they recur or have high severity. Keep each lesson short and actionable.

## Engineering Lessons

- When splitting a JS/TS file into modules, a missing import referenced only inside a function body (not at module top level) is invisible to `node --check`, to `tsc`, and to a mocked/concatenated test harness where every file shares one scope. It only surfaces when that exact function is actually called. Recurred 3 times in the `extension/background.js` split (2026-08-20/21) before being caught. Prevention: after any file split, either run a static undefined-identifier check per file (not just a syntax check), or add one functional regression test per exported function that calls it through a real `import()` with representative inputs — a passing test for one function in a file does not cover another function in the same file. See `.ai/decisions.md` (2026-08-20/21 entry).

## Workflow Lessons

- 
