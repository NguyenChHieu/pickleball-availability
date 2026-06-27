# Messenger Bot Research

Last checked: 2026-06-27

## Findings

- Meta Messenger Platform is built around Facebook Pages. A user messages a Page, Meta sends webhook events, and the app replies through the Send API with a Page access token.
- The official docs describe Page-scoped IDs, Page access tokens, webhook events where `sender.id` is a PSID and `recipient.id` is the Page ID, and replying within the messaging window.
- I did not find an official path for adding a bot to an existing personal Messenger group chat. Treat that as unsupported until proven otherwise by current Meta docs/app tooling.
- Unofficial `facebook-chat-api` style packages exist, but they usually automate a personal Facebook account session. Do not use that for this project; it is brittle and likely against platform expectations.
- I did not find a Messenger-specific MCP server in the local Codex tool registry or npm package search. Existing packages are normal bot SDKs/adapters, not MCP runtimes.

## Useful Packages Found

- `@chat-adapter/messenger`: Facebook Messenger adapter for Vercel Chat SDK style apps.
- `@builderbot/provider-facebook-messenger`: Messenger provider for BuilderBot.
- `wingbot`: broader bot framework with Facebook/Messenger support.
- `@modelcontextprotocol/sdk`: useful only if we build our own MCP/dev tool later.

## Sources

- Meta Messenger Platform overview: https://developers.facebook.com/docs/messenger-platform/overview/
- Meta send messages docs: https://developers.facebook.com/docs/messenger-platform/send-messages/
- Meta Messenger webhooks docs: https://developers.facebook.com/docs/messenger-platform/webhooks/
- `@chat-adapter/messenger`: https://www.npmjs.com/package/@chat-adapter/messenger
- `@builderbot/provider-facebook-messenger`: https://www.npmjs.com/package/@builderbot/provider-facebook-messenger
- `wingbot`: https://www.npmjs.com/package/wingbot
- Model Context Protocol SDK: https://www.npmjs.com/package/@modelcontextprotocol/sdk

## Recommended Direction

Use a tiny backend as the source of truth:

1. Chrome extension reads availability from the logged-in browser and posts latest venue payloads to the backend.
2. Backend stores latest payload per venue.
3. Messenger bot webhook answers questions from cached payloads.
4. If Messenger group chat is not supported, use one of these alternatives:
   - a Page DM bot that each friend can message directly,
   - a small web/share page link that can be pasted into the group,
   - Telegram/Discord bot if the group can move there,
   - manual "copy summary" from the extension as the simplest near-term fallback.

## Proposed V1

- Add a `Copy Summary` button to the extension first.
- Add a backend endpoint:
  - `POST /api/availability/:venueId` from extension
  - `GET /api/availability/:venueId` for bot/web clients
- Then add Messenger webhook support if Page DM flow is acceptable.

## Open Question

The key product decision is whether the group must stay in an existing Messenger group chat. If yes, official Messenger Platform may not be enough. If Page DM or another chat platform is acceptable, implementation is straightforward.
