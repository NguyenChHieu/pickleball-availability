# Direct Refresh Notes

Goal: reduce the need to manually open the ProPickle schedule page.

## What Works

- The backend cannot fetch ProPickle directly without a browser session. A plain request to `https://book.propickle.com.au/book/ProPickle?skip_waivers=true` returns `403`.
- The extension can still use the normal Chrome session where the user is already logged in.
- ProPickle venue refresh now starts at:

```text
https://book.propickle.com.au/book/ProPickle?skip_waivers=true
```

If the user is already logged in and the schedule widget loads normally, the extension should:

1. Open the booking page in an inactive tab.
2. Wait for the Playbypoint `BookBox` widget.
3. Read availability.
4. Sync the backend cache.
5. Close the inactive tab.

## What Still Requires Manual Setup

Manual setup is still required if the site shows:

- login,
- Cloudflare/security verification,
- waiver/conditions,
- or any page where the schedule widget is not visible.

In that case, the extension activates the tab and asks the user to finish setup. It keeps a short-lived pending refresh for that tab, then retries automatically after page loads or short timer ticks. When the `BookBox` widget appears, it reads, syncs, and closes the tab if the extension opened it.

One subtle logged-out state still renders the `BookBox` date buttons but shows `LOGIN TO CONTINUE` instead of time slots. The provider treats that as not readable so it does not sync a false empty availability result.

Another login flow can redirect to a profile/account page after successful login. While a pending refresh is active, the background worker can return that same tab to the venue booking URL once, then continue watching for the schedule widget.

## Why Not Backend-Only Yet?

A Render cron job would need a ProPickle login/session cookie or an official Playbypoint API token. That is a bigger security and maintenance tradeoff than using the browser session.

The safer path is:

```text
logged-in Chrome -> extension refresh -> backend cache -> share page / bot
```

Future work can still inspect logged-in Network/XHR traffic to see whether Playbypoint exposes a clean same-session JSON endpoint. If it does, the extension provider can call that endpoint directly instead of scraping the DOM.
