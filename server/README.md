# Availability Bot Backend

Small Node backend for turning extension-scraped availability into bot replies.

No dependencies are required.

## Run Locally

```bash
cd server
set AVAILABILITY_SYNC_TOKEN=dev-secret
set MESSENGER_VERIFY_TOKEN=dev-verify-token
node src/index.js
```

PowerShell:

```powershell
cd server
$env:AVAILABILITY_SYNC_TOKEN = "dev-secret"
$env:MESSENGER_VERIFY_TOKEN = "dev-verify-token"
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
```

Then refresh/read ProPickle from the extension. Successful reads are posted to:

```text
POST /api/availability/propickle
```

## Test The Cache

```bash
curl http://localhost:8787/api/availability/propickle/summary
```

Expected output is a Messenger-friendly text summary, for example:

```text
ProPickle availability, last read 27 Jun 2026, 4:10 pm:
Saturday, Jun 27: 7am-9am, 2pm-4pm (4h)
Sunday, Jun 28: no open intervals
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
```

If `MESSENGER_PAGE_ACCESS_TOKEN` is missing, the server logs dry-run replies instead of sending them.

## Deployment Note

Meta Messenger webhooks require a public HTTPS URL. For local development, use a tunnel such as ngrok pointing at `localhost:8787`.
