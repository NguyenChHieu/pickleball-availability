# Extension QA Playbook

Use this before committing or pushing changes that touch the Chrome extension, refresh jobs, venue providers, share-page refresh, or popup UX.

## Automated Checks

Run these first:

```powershell
node --check extension\background.js
node --check extension\contentScript.js
node --check extension\popup.js
node --check extension\options.js
node --check extension\venues.js
node --check extension\bookingDeepLink.js
node --check extension\sharePageBridge.js
node --check extension\providers\playbypointBookBox.js
node --check extension\providers\clubsparkBookByDate.js
node --check extension\providers\mindbodyAppointments.js
node --check extension\providers\playtomicAvailability.js
node --check extension\providers\podplayDom.js
node --check extension\providers\hamletExperience.js
python -m json.tool extension\manifest.json
```

If the change affects web/share pages too:

```powershell
npm.cmd --prefix web run test:fixtures
npm.cmd --prefix web run typecheck -- --incremental false
npm.cmd --prefix web run lint
npm.cmd --prefix web run build
```

On this Windows checkout, if `next build` fails only with `EPERM` writing `web\.next\trace*`, rerun the same build with approved filesystem access before treating it as a code failure.

## Manual Chrome QA

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Reload the unpacked `extension/` package.
4. Open the popup.
5. Confirm saved results load without automatically refreshing.
6. Confirm long venue names wrap instead of clipping.
7. Tick at least two venues in Saved results.
8. Click `Refresh Selected`.
9. Confirm a separate, unfocused reader window opens only when a venue page must be read.
10. Confirm up to three venue tabs run there while the current browser window keeps focus.
11. Confirm successful temporary tabs and an empty reader window close after the job.
12. If a venue needs setup, confirm its tab stays open and `Open setup window` appears in the popup.
13. Confirm deep scans still open a visible reader window and run one venue at a time.
14. Confirm loader, status, and recent refresh history stay in the refresh panel.
15. Confirm share actions appear only when a synced saved payload exists.

## Share Page QA

1. Open a venue share page, for example `/s/dev-share/wotso-pyrmont`.
2. Confirm the header does not clip the venue name at desktop, laptop, tablet, and mobile widths.
3. Open the Venues menu.
4. Confirm outside click and Escape close it.
5. Click `Refresh`.
6. Confirm the extension starts a venue refresh, not just a browser page reload.
7. Confirm the share page updates or reloads only after the venue sync succeeds.

## Web Dashboard QA

1. Open `/app` and confirm cached venue summaries render before any refresh starts.
2. Confirm the dashboard reports `Extension live` after reloading the unpacked extension and the page.
3. Search by venue name and booking platform.
4. Select two venues and confirm unselected venues sort before selected venues.
5. Click `Refresh Selected` and confirm the existing background refresh job runs in parallel where supported.
6. Confirm progress, per-venue duration, failures, and setup-required actions update without blocking the page.
7. Confirm the cached summaries update after the refresh job finishes and sync succeeds.
8. Click `Refresh Stale` and confirm only stale or missing results are requested.
9. Confirm refresh history is collapsed by default and shows the latest five completed jobs when opened.
10. Check `/app` at desktop, tablet, and mobile widths for horizontal clipping.

## Slow Venue QA

North Ryde can be slow because it checks many courts/providers.

- Test it separately when possible.
- Prefer normal refresh first.
- Use deep scan only when you need same-court/provider detail.
- Treat partial failure as useful if the last good cached result remains available and the status explains what failed.

## Release Judgment

Ready when:

- Automated checks pass.
- One real `Refresh Selected` run succeeds after reloading the unpacked extension.
- Share page refresh works for at least one venue.
- Slow venues either succeed or fail with preserved cached data and clear messaging.
