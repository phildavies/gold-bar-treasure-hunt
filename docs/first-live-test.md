# First Live Scan Test

Goal: one stable real-world QR scan flow using the existing Google Sheet.

Do not enable rewards during this test.

## 1. Confirm The Existing Sheet

Use this spreadsheet:

```text
https://docs.google.com/spreadsheets/d/1AdVgrGRQjc-cisIOE6Bx55RHLFmP9NqThOFBFC2Uq3Y/edit
```

Confirm these tabs exist:

- `QR_Scans`
- `QR_Player_Unique`
- `QR_Player_Master`
- `Game Tiers`

`QR_Scans` is the raw append-only scan log. Do not clear it unless you have made a backup.

## 2. Deploy Apps Script

1. Open [script.google.com](https://script.google.com).
2. Open the treasure hunt Apps Script project.
3. Replace the script with `backend/apps-script.js`.
4. Confirm the script contains:

```js
SPREADSHEET_ID: "1AdVgrGRQjc-cisIOE6Bx55RHLFmP9NqThOFBFC2Uq3Y"
```

5. Click `Deploy`.
6. Choose `New deployment`.
7. Select type `Web app`.
8. Set `Execute as` to `Me`.
9. Set `Who has access` to `Anyone`.
10. Deploy and copy the Web App URL.

## 3. Health Check

Open:

```text
YOUR_WEB_APP_URL?action=health
```

Expected response:

```json
{
  "ok": true,
  "service": "Gold Bar Treasure Hunt Scan Tracking API",
  "scan_key_format": "player_uuid + '_' + qr_id"
}
```

If this fails, do not continue to Joomla yet.

## 4. Prepare Frontend Config

Copy:

```text
frontend/config.js.example
```

to:

```text
frontend/config.js
```

Set:

```js
window.GoldBarTreasureHuntConfig = {
  apiUrl: "YOUR_WEB_APP_URL",
  albatoWebhookUrl: "",
  debug: true,
  testMode: true,
  requestTimeoutMs: 12000,
  retryCount: 1,
  retryDelayMs: 1500
};
```

For the first live test, keep `debug: true` and `testMode: true`.

## 5. Joomla Script Placement

Add these scripts to the Joomla page/template. Recommended order:

```html
<script src="/frontend/config.js"></script>
<script src="/frontend/player.js"></script>
<script src="/frontend/tracking.js"></script>
<script src="/frontend/live-status.js"></script>
<script src="/frontend/debug-overlay.js"></script>
```

`live-status.js` is the field-facing mobile status panel. The debug overlay is optional but recommended for the first live scan. It can be toggled with the `Hide` / `Show` button.

## 6. Joomla Tracking UI

Add this small block to the QR page:

```html
<section class="treasure-hunt-widget">
  <form data-gb-player-form>
    <label>
      Display name (optional)
      <input data-gb-player-input type="text" autocomplete="nickname">
    </label>
    <button type="submit">Save name</button>
  </form>

  <p>Player: <strong data-gb-player-display>No player set</strong></p>
  <p data-gb-progress>Found 0 clues</p>
  <p data-gb-message hidden></p>
</section>
```

Important:

- `player_uuid` is generated automatically in the browser.
- `player_id` is only the optional display name.
- `scan_key` is always:

```text
player_uuid + "_" + qr_id
```

## 7. Test URL

Open a real QR page with a test QR ID:

```text
https://thegoldbarkohtao.com/en/treasure-hunt/bird-baths/?qr_id=birdbath-live-test-01
```

Use a fresh phone browser or private window for the cleanest first test.

## 8. Browser DevTools Checks

On desktop, open DevTools Console.

Expected grouped logs:

```text
[GoldBarTreasureHunt] test mode init
[GoldBarTreasureHunt] progress count
[GoldBarTreasureHunt] scan submitted
[GoldBarTreasureHunt] API response
```

The debug overlay should show:

- `player_uuid`: a generated UUID or `gb-...` ID
- `qr_id`: `birdbath-live-test-01`
- `API`: `ok`
- `duplicate`: `new/not scanned`
- `progress`: `1 unique / 1 total`

## 9. Expected API Response

For the first scan:

```json
{
  "ok": true,
  "player_uuid": "GENERATED_PLAYER_UUID",
  "qr_id": "birdbath-live-test-01",
  "scan_key": "GENERATED_PLAYER_UUID_birdbath-live-test-01",
  "scan_key_format": "player_uuid + '_' + qr_id",
  "is_duplicate": false,
  "unique_scan_count": 1,
  "total_scan_count": 1
}
```

Refresh the same page.

Expected duplicate response:

```json
{
  "ok": true,
  "is_duplicate": true,
  "unique_scan_count": 1,
  "total_scan_count": 2
}
```

## 10. Expected Google Sheet Updates

In `QR_Scans`, a new row should appear:

| Column | Expected value |
| --- | --- |
| A `player_id` | optional display name, or blank |
| B `qr_id` | `birdbath-live-test-01` |
| C `timestamp` | current timestamp |
| D `scan_key` | `player_uuid + "_" + qr_id` |
| E `player_uuid` | generated browser UUID |

In `QR_Player_Master`, the matching player row should:

- exist by `player_uuid`
- have `last_seen_at` updated
- have `unique_scan_count (number)` updated
- have `last_qr_id (latest scanned)` set to the QR ID
- have `last_scan_at (timestamp)` updated

## 11. Weak Mobile Internet Test

Temporarily use weak signal or DevTools throttling.

Expected behavior:

- scan submission times out after `requestTimeoutMs`
- one retry is attempted
- console logs `scan attempt failed; retrying`
- if retry fails, the page says:

```text
Connection problem. The clue is visible, but tracking did not save. Try again with stronger signal.
```

No reward logic should run.

## 12. Troubleshooting Flow

### No debug overlay appears

Check:

- `debug-overlay.js` is loaded after `tracking.js`
- browser console has no 404 errors
- page has not blocked custom scripts

### API says tracking is not configured

Check:

- `config.js` loads before `tracking.js`
- `apiUrl` is the Apps Script Web App URL, not the Apps Script editor URL

### API response is not JSON

Check:

- Apps Script deployment is a Web App
- access is set to `Anyone`
- you copied the `/exec` URL

### Sheet does not update

Check:

- health endpoint returns `ok: true`
- Apps Script has permission to access the spreadsheet
- `SPREADSHEET_ID` points to the existing sheet
- required tabs have not been renamed

### Duplicate is always false

Check:

- `player_uuid` remains the same after refresh
- `scan_key` in `QR_Scans` uses the same UUID and QR ID
- browser localStorage is not cleared between tests

### Duplicate is always true

Check:

- you are testing with the same `qr_id`
- use a new QR ID for the second unique scan test

## 13. Pass Criteria

The first live scan test passes when:

- health endpoint returns `ok: true`
- first scan logs to `QR_Scans`
- refresh logs another row but returns `is_duplicate: true`
- progress remains `Found 1 clues` after duplicate
- second unique QR increases progress
- debug overlay shows correct UUID, QR ID, API status, duplicate status, and progress
