# Phase 1 Setup Guide

## 1. Use The Existing Google Sheet

Do not create a replacement database for Phase 1. Use the existing development sheet:

```text
https://docs.google.com/spreadsheets/d/1AdVgrGRQjc-cisIOE6Bx55RHLFmP9NqThOFBFC2Uq3Y/edit
```

Existing Phase 1 tabs:

- `QR_Scans`
- `QR_Player_Unique`
- `QR_Player_Master`
- `Game Tiers`

## 2. Create The Apps Script API

1. Open [script.google.com](https://script.google.com).
2. Create a new project.
3. Paste the contents of `backend/apps-script.js`.
4. Confirm this value is present:

```js
SPREADSHEET_ID: "1AdVgrGRQjc-cisIOE6Bx55RHLFmP9NqThOFBFC2Uq3Y"
```

This points Apps Script at the existing development sheet.

5. Optional: restrict accepted QR codes:

```js
ALLOWED_QR_IDS: ["birdbaths01", "beach01", "pier01", "viewpoint01", "goldbar01"]
```

If `ALLOWED_QR_IDS` is empty, any clean `qr_id` is accepted.

## 3. Deploy The Apps Script

1. Click `Deploy`.
2. Choose `New deployment`.
3. Select type `Web app`.
4. Set `Execute as` to `Me`.
5. Set `Who has access` to `Anyone`.
6. Deploy.
7. Copy the Web App URL.

Test it by opening:

```text
YOUR_WEB_APP_URL?action=health
```

Expected result includes:

```json
{
  "ok": true
}
```

## 4. Create Production Config

Copy:

```text
frontend/config.js.example
```

to:

```text
frontend/config.js
```

Then update:

```js
window.GoldBarTreasureHuntConfig = {
  apiUrl: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE",
  albatoWebhookUrl: "",
  debug: true,
  testMode: true,
  requestTimeoutMs: 12000,
  retryCount: 1,
  retryDelayMs: 1500
};
```

For live testing, keep `debug: true`.

After the system is stable, you can set:

```js
debug: false
```

## 5. Add Scripts To Joomla

Upload these files to your site:

```text
config.js
player.js
tracking.js
live-status.js
debug-overlay.js
```

Add them to the Joomla page or template. This script order is recommended:

```html
<script src="/frontend/config.js"></script>
<script src="/frontend/player.js"></script>
<script src="/frontend/tracking.js"></script>
<script src="/frontend/live-status.js"></script>
<script src="/frontend/debug-overlay.js"></script>
```

The tracker also retries initialization briefly if `tracking.js` loads before `player.js`, which helps with Joomla template quirks.

## 6. Add The Small Tracking UI

Add this where you want the player and progress status to appear:

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

## 7. Keep Existing QR URLs

No QR redesign is needed. Keep URLs like:

```text
https://thegoldbarkohtao.com/en/treasure-hunt/bird-baths/?qr_id=birdbaths01
```

Only the `qr_id` value needs to be unique per clue.
