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

## Persistent Cache

By default, cached availability is stored in:

```text
server/data
```

For deployed hosts, set `AVAILABILITY_DATA_DIR` to a persistent disk mount path so the share link survives restarts and redeploys:

```text
AVAILABILITY_DATA_DIR=/var/data
```

Keep `AVAILABILITY_SYNC_TOKEN` and `SHARE_TOKEN` set in production. The backend refuses to start on Render without both.

## Supabase Cache

Supabase is preferred once the share link should survive Render restarts without using a Render disk.

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run:

```sql
create table if not exists public.availability_cache (
  venue_id text primary key,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.availability_cache enable row level security;
```

The same SQL is saved in `server/supabase.sql`.

Then set these Render environment variables:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Keep the Supabase service-role key only on the backend. Do not put it in the browser extension.

Optional:

```text
SUPABASE_AVAILABILITY_TABLE=availability_cache
```

If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both present, the backend uses Supabase. If neither is present, it uses the local file cache. If only one is present, startup fails so the app does not silently write to the wrong place.

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
AVAILABILITY_SYNC_TOKEN=...
AVAILABILITY_DATA_DIR=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

If `MESSENGER_PAGE_ACCESS_TOKEN` is missing, the server logs dry-run replies instead of sending them.

## Deployment Note

Meta Messenger webhooks require a public HTTPS URL. For local development, use a tunnel such as ngrok pointing at `localhost:8787`.

On Render or another deployed host, set real unguessable `SHARE_TOKEN` and `AVAILABILITY_SYNC_TOKEN` values. The local fallback share token is `dev-share` only for development.
