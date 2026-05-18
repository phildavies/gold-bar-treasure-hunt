# Phase 1 Setup Guide

## 1. Create The Google Sheet

Create a Google Sheet named:

```text
Gold Bar Treasure Hunt Database
```

Copy the Sheet ID from the URL:

```text
https://docs.google.com/spreadsheets/d/SHEET_ID_IS_HERE/edit
```

Phase 1 uses these tabs:

- `scans`
- `players`

The Apps Script creates them automatically.

## 2. Create The Apps Script API

1. Open [script.google.com](https://script.google.com).
2. Create a new project.
3. Paste the contents of `backend/apps-script.js`.
4. Replace:

```js
SPREADSHEET_ID: "PASTE_GOOGLE_SHEET_ID_HERE"
```

with your real Google Sheet ID.

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

## 4. Add Frontend Scripts To The Website

Upload these files to the website:

```text
/frontend/player.js
/frontend/tracking.js
```

On each treasure hunt page, add this before the closing `</body>` tag:

```html
<script>
  window.GoldBarTreasureHuntConfig = {
    apiUrl: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE",
    albatoWebhookUrl: ""
  };
</script>
<script src="/frontend/player.js"></script>
<script src="/frontend/tracking.js"></script>
```

To keep Albato logging during the transition:

```js
albatoWebhookUrl: "PASTE_EXISTING_ALBATO_WEBHOOK_URL_HERE"
```

## 5. Add The Small Tracking UI

Add this where you want the player and progress status to appear:

```html
<section class="treasure-hunt-widget">
  <form data-gb-player-form>
    <label>
      Player name or code
      <input data-gb-player-input type="text" autocomplete="nickname" required>
    </label>
    <button type="submit">Save player</button>
  </form>

  <p>Player: <strong data-gb-player-display>No player set</strong></p>
  <p data-gb-progress>Unique clues found: 0 | Total scans: 0</p>
  <p data-gb-message hidden></p>
</section>
```

## 6. Keep Existing QR URLs

No QR redesign is needed. Keep URLs like:

```text
https://thegoldbarkohtao.com/en/treasure-hunt/bird-baths/?qr_id=birdbaths01
```

Only the `qr_id` value needs to be unique per clue.
