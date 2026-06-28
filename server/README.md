# Availability Bot Backend

Small Node backend for turning extension-scraped availability into bot replies.

No dependencies are required.

## Run Locally

```bash
cd server
set AVAILABILITY_SYNC_TOKEN=dev-secret
set MESSENGER_VERIFY_TOKEN=dev-verify-token
set SHARE_TOKEN=dev-share
node src/index.js
```

PowerShell:

```powershell
cd server
$env:AVAILABILITY_SYNC_TOKEN = "dev-secret"
$env:MESSENGER_VERIFY_TOKEN = "dev-verify-token"
$env:SHARE_TOKEN = "dev-share"
node src/index.js
```

The server listens on:

```text
http://localhost:8787
```

## Extension Sync

In Chrome, open the extension details and choose **Extension options**.

Use:

```text
Backend URL: http://localhost:8787
Sync token: dev-secret
Share URL base: http://localhost:8787
Share token: dev-share
```

Then refresh/read ProPickle from the extension. Successful reads are posted to:

```text
POST /api/availability/propickle
```

## Test The Cache

```bash
curl -H "x-sync-token: dev-secret" http://localhost:8787/api/availability/propickle/summary
```

Expected output is a Messenger-friendly text summary, for example:

```text
ProPickle availability, last read 27 Jun 2026, 4:10 pm:
Saturday, Jun 27: 7am-9am, 2pm-4pm (4h)
Sunday, Jun 28: no open intervals
```

## Share Page

The share page reads the same cached payload as the bot formatter. It never triggers scraping itself.

```text
http://localhost:8787/s/dev-share/propickle
http://localhost:8787/s/dev-share/propickle/text
```

The HTML page is intended for phones and shows one section per day with merged open interval chips. The `/text` endpoint returns the same bot-style summary used by Messenger replies.

Invalid share tokens return `404`:

```text
http://localhost:8787/s/wrong/propickle
```

## Messenger Webhook

Webhook verify endpoint:

```text
GET /webhook/messenger
```

Message webhook endpoint:

```text
POST /webhook/messenger
```

Environment variables:

```text
MESSENGER_VERIFY_TOKEN=...
MESSENGER_PAGE_ACCESS_TOKEN=...
GRAPH_API_VERSION=v24.0
SHARE_TOKEN=...
```

If `MESSENGER_PAGE_ACCESS_TOKEN` is missing, the server logs dry-run replies instead of sending them.

## Deployment Note

Meta Messenger webhooks require a public HTTPS URL. For local development, use a tunnel such as ngrok pointing at `localhost:8787`.

On Render or another deployed host, set a real unguessable `SHARE_TOKEN`. The local fallback token is `dev-share` only for development.
