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
9. Confirm status says multiple venues can run at once when applicable.
10. Confirm loader, status, and recent refresh history stay in the refresh panel.
11. Confirm share actions appear only when a synced saved payload exists.

## Share Page QA

1. Open a venue share page, for example `/s/dev-share/wotso-pyrmont`.
2. Confirm the header does not clip the venue name at desktop, laptop, tablet, and mobile widths.
3. Open the Venues menu.
4. Confirm outside click and Escape close it.
5. Click `Refresh`.
6. Confirm the extension starts a venue refresh, not just a browser page reload.
7. Confirm the share page updates or reloads only after the venue sync succeeds.

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
