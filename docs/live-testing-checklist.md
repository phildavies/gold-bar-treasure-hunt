# Live Phase 1 Testing Checklist

Use this checklist on a real phone and on a desktop browser before putting QR codes in front of tourists.

## Before Testing

1. Deploy the Google Apps Script as a web app.
2. Open:

```text
YOUR_WEB_APP_URL?action=health
```

3. Confirm the response includes `"ok": true`.
4. Confirm the Google Sheet has `QR_Scans`, `QR_Player_Unique`, `QR_Player_Master`, and `Game Tiers` tabs.
5. Copy `frontend/config.js.example` to `frontend/config.js`.
6. Put the real Apps Script web app URL in `apiUrl`.
7. Keep `debug: true` during live testing.
8. Add `config.js`, `player.js`, and `tracking.js` to the Joomla page or template.
9. Add the tracking UI block from `docs/setup.md`.

For the first real scan, use [first-live-test.md](first-live-test.md).

## Browser Console Checks

Open DevTools, then open a QR page with a test `qr_id`:

```text
https://thegoldbarkohtao.com/en/treasure-hunt/bird-baths/?qr_id=birdbaths01
```

Expected console logs:

```text
[GoldBarTreasureHunt] test mode init
[GoldBarTreasureHunt] progress count
```

The page should not require a display name. `player_uuid` is created automatically.

The debug overlay should show a generated `player_uuid`.

## First Scan Test

1. Optionally enter a test display name, for example:

```text
testplayer01
```

2. Click `Save name` if the form is present. Otherwise just load the QR page.
3. Watch the browser console.

Expected console logs:

```text
[GoldBarTreasureHunt] scan submitted
[GoldBarTreasureHunt] API response
[GoldBarTreasureHunt] progress count
```

Expected page message:

```text
Clue saved.
```

Expected progress text:

```text
Found 1 clues
```

Expected Google Sheets result:

- `QR_Scans` has a new row.
- `player_id` is the optional display name, or blank.
- `qr_id` is `birdbaths01`.
- `scan_key` is `player_uuid + "_birdbaths01"`.
- API response has `is_duplicate: false`.
- API response has `unique_scan_count: 1`.

## Duplicate Scan Test

1. Refresh the same QR page.
2. Keep the same player.
3. Watch the browser console.

Expected console logs:

```text
[GoldBarTreasureHunt] duplicate detected
[GoldBarTreasureHunt] API response
```

Expected page message:

```text
Duplicate scan. This clue was already saved for this player.
```

Expected progress text:

```text
Found 1 clues
```

Expected Google Sheets result:

- A new row is still logged in `QR_Scans`.
- API response has `is_duplicate: true`.
- API response has `unique_scan_count: 1`.
- API response has increased `total_scan_count`.

## Second QR Test

Open a different QR page:

```text
https://thegoldbarkohtao.com/en/treasure-hunt/another-location/?qr_id=testclue02
```

Expected result:

- Page says `Clue saved.`
- Progress says `Found 2 clues`.
- `QR_Scans` has a new row with `qr_id` as `testclue02`.
- `is_duplicate` is `FALSE`.

## Missing QR Test

Open a treasure page without `qr_id`:

```text
https://thegoldbarkohtao.com/en/treasure-hunt/bird-baths/
```

Expected result:

- Page says `This page is missing a QR code ID.`
- Console logs `missing qr_id`.
- No new scan row is created.

## Player UUID Persistence Test

1. In the browser console, run:

```js
localStorage.removeItem("goldbar_treasure_player_uuid");
localStorage.removeItem("goldbar_treasure_player_display_name");
location.reload();
```

2. Reload a QR page with `?qr_id=birdbaths01`.

Expected result:

- Console logs a generated `player_uuid`.
- Debug overlay shows that same `player_uuid`.
- A scan can save without a display name.
- Refreshing again keeps the same `player_uuid`.

## Weak Connection Test

1. Open DevTools.
2. Set network throttling to a slow mobile profile, or briefly disable Wi-Fi/mobile data.
3. Reload a QR page.

Expected result if offline:

- Page says `You appear to be offline. Reconnect and reload this page to save the clue.`
- Console logs `offline before scan submission`.
- No duplicate or partial credit is created.

Expected result if the request times out:

- Page says `Connection problem. The clue is visible, but tracking did not save. Try again with stronger signal.`
- Console logs `API failure`.

## Final Pass

Before live launch, confirm:

- `config.js` has the production Apps Script web app URL.
- `debug` is still `true` for the first live test day.
- Every live QR URL includes a unique `qr_id`.
- The Google Sheet has no accidental test rows you want removed.
- A staff member can open the Sheet and verify rows while testing.
