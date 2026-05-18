# Gold Bar Koh Tao Treasure Hunt

Phase 1 scan tracking for The Gold Bar Koh Tao treasure hunt.

This phase keeps the existing QR URL format, stores a player ID in the visitor's browser, sends scans to Google Apps Script, logs to Google Sheets, and prevents duplicate scan credit.

Rewards, email capture, staff validation, and leaderboard features are intentionally left out of Phase 1.

Phase 1 uses the existing development Google Sheet instead of creating a replacement database.

## Structure

```text
/frontend
  config.js.example
  debug-overlay.js
  live-status.js
  player.js
  tracking.js

/backend
  apps-script.js

/docs
  architecture.md
  setup.md
  testing.md
```

## Phase 1 Features

- Reads `qr_id` from URLs like `?qr_id=birdbaths01`.
- Stores generated `player_uuid` in browser storage.
- Automatically reuses the same player ID on future scans.
- Sends scan data to Google Apps Script.
- Logs every scan attempt to Google Sheets.
- Prevents duplicate credit using `scan_key = player_uuid + "_" + qr_id`.
- Tracks unique scans and total scans.
- Optionally mirrors scan attempts to the existing Albato webhook.

## Start Here

1. Read [docs/setup.md](docs/setup.md).
2. Paste [backend/apps-script.js](backend/apps-script.js) into Google Apps Script.
3. Copy [frontend/config.js.example](frontend/config.js.example) to `config.js` and add your Apps Script URL.
4. Add `config.js`, `player.js`, `tracking.js`, `live-status.js`, and optionally `debug-overlay.js` to the Joomla page or template.
5. Review [docs/existing-sheet-analysis.md](docs/existing-sheet-analysis.md).
6. Test with [docs/live-testing-checklist.md](docs/live-testing-checklist.md).
