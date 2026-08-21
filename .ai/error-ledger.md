# Error Ledger

Record repeated or costly mistakes so future sessions can avoid them.

| Date | Error pattern | Impact | Root cause | Prevention | Linked sessions |
|---|---|---|---|---|---|
| 2026-08-20/21 | Missing import used only inside a function body, in a freshly-split ES module | Shipped to `main` twice past `node --check` and the full test suite; one instance only caught live, by the user's manual "Refresh Selected" click in Chrome | `node --check`/`tsc` don't evaluate function bodies for undefined names, and the mocked/concatenated test harness runs every split file in one shared scope, so a missing import is invisible there too | Per exported function, add a functional regression test that calls it through a real `import()`; for a bigger split, also run a one-off static undefined-identifier audit across every file | `.ai/worklog/2026-08.jsonl` (428e03e, 00a86fd); see `.ai/lessons.md` |
