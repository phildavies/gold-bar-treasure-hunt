# Field Testing Checklist

Use this checklist for real-world outdoor QR testing on Koh Tao before public launch.

Do not enable rewards during this test.

## Setup Confirmation

1. Deploy the latest `backend/apps-script.js`.
2. Open:

```text
YOUR_WEB_APP_URL?action=health
```

3. Confirm the response includes `"ok": true`.
4. Confirm `frontend/config.js` has:

```js
debug: true,
testMode: true,
showDebugOverlay: true,
enableOfflineQueue: true,
enableVibration: true
```

5. Confirm Joomla loads scripts in this order:

```html
<script src="/frontend/config.js"></script>
<script src="/frontend/player.js"></script>
<script src="/frontend/tracking.js"></script>
<script src="/frontend/live-status.js"></script>
<script src="/frontend/debug-overlay.js"></script>
```

## Multiple-Device Testing

Test at least:

- iPhone Safari
- Android Chrome
- one desktop browser
- one phone using mobile data
- one phone using venue Wi-Fi

For each device:

1. Open a QR URL with `?qr_id=fieldtest01`.
2. Confirm the live status panel appears.
3. Confirm it shows `Clue saved`.
4. Confirm progress says `Found 1 clues`.
5. Confirm `QR_Scans` gets a row with lowercase `qr_id`.
6. Confirm `player_uuid` appears in column E.

## Duplicate Testing

On the same device:

1. Refresh the same QR page.
2. Confirm the status changes to `Already found`.
3. Confirm progress does not increase.
4. Confirm the API response has:

```json
{
  "is_duplicate": true
}
```

5. Confirm `QR_Scans` logs another row, but unique progress stays the same.

## Second QR Testing

On the same device:

1. Open a different QR URL:

```text
?qr_id=fieldtest02
```

2. Confirm the status says `Clue saved`.
3. Confirm progress increases to `Found 2 clues`.
4. Confirm `scan_key` uses:

```text
player_uuid + "_fieldtest02"
```

## Weak Internet Testing

Test with poor signal or DevTools network throttling.

1. Open a QR page while online but throttled.
2. Confirm status shows `Saving scan` or `Retrying scan`.
3. Confirm API latency appears, for example:

```text
API: 1480 ms
```

4. If the first attempt fails, confirm retry status appears.

Expected failure message:

```text
Connection problem. The clue is visible, but tracking did not save. Try again with stronger signal.
```

## Offline Queue Testing

1. Turn on airplane mode.
2. Open a QR page that is already cached or available.
3. Confirm status shows `Offline` or `Scan not saved`.
4. Confirm live status shows queued scan count if the scan was queued.
5. Turn internet back on.
6. Confirm automatic retry runs.
7. Confirm status becomes `Clue saved` or `Already found`.
8. Confirm `QR_Scans` receives the row.

Important:

- The queue is temporary browser storage.
- If the browser clears site data, queued scans can be lost.
- The queue is only for short field-test connection drops.

## QR Typo Testing

Open URLs with bad QR inputs:

```text
?qr_id= Wind Chimes 01
?qr_id=WindChimes01
?qr_id=windchimes01
?qr_id=windchimes01!!!
```

Expected:

- frontend normalizes to lowercase.
- backend writes normalized `qr_id`.
- new rows use normalized scan keys.

If `ALLOWED_QR_IDS` is configured in Apps Script:

- unknown QR IDs should return an error.
- live status should show a failure state.
- no bad row should be counted as valid progress.

## Browser Compatibility

### iPhone Safari

Check:

- `player_uuid` persists after refresh.
- live status panel fits the screen.
- debug overlay can be hidden.
- vibration may not fire unless Safari allows it; this is acceptable.
- private browsing may limit storage, so test normal Safari too.

### Android Chrome

Check:

- vibration fires on a successful new scan if enabled.
- offline/online events trigger automatic retry.
- live status panel remains readable outdoors.
- refresh preserves `player_uuid`.

### Desktop Browser

Check:

- console grouped logs are readable.
- DevTools network panel shows Apps Script POST.
- API response JSON matches expectations.

## Expected Google Sheet Updates

In `QR_Scans`:

- Column A: optional display name.
- Column B: lowercase normalized `qr_id`.
- Column C: timestamp.
- Column D: `player_uuid + "_" + normalized_qr_id`.
- Column E: `player_uuid`.

In `QR_Player_Master`:

- one row per `player_uuid` should be updated.
- `unique_scan_count (number)` should increase only for unique QR IDs.
- `last_qr_id (latest scanned)` should be normalized lowercase.
- `last_scan_at (timestamp)` should update.

## Pass Criteria

Field testing passes when:

- iPhone Safari can save a new scan.
- Android Chrome can save a new scan.
- duplicate scan does not increase progress.
- weak internet shows retry/failure state clearly.
- reconnect retries queued scans.
- QR IDs are written lowercase.
- `scan_key` is consistently normalized.
- no reward flow appears.
