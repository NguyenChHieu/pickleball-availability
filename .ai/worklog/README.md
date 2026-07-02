# Worklog

Use monthly JSONL files: `YYYY-MM.jsonl`. One session/task per line.

Example:

```json
{"date":"YYYY-MM-DD","tool":"claude-code","session_id":"...","lane":"CONTROLLED","task":"Add billing webhook handler","category":"feature","plugins":["gsd","ponytail-review"],"files_changed":["src/billing/webhook.ts","tests/billing.test.ts"],"validation":["npm test -- billing"],"errors":["initially missed idempotency check"],"lessons":["Webhook handlers must check existing event IDs before side effects"],"next":"Add duplicate-event integration test"}
```

Guidelines:

- Record meaningful implementation/debugging/review sessions.
- Do not store secrets or raw prompt transcripts.
- Keep entries compact.
- Weekly reflection reads these logs and proposes improvements in `.ai/learning-inbox.md`.
