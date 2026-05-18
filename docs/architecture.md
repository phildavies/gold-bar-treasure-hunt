# Phase 1 Architecture

## Goal

Phase 1 is stable scan tracking only.

It answers these questions:

- Which generated `player_uuid` identifies the player?
- Which QR code did they scan?
- Has this player already scanned this QR code?
- How many unique clues has this player found?

It does not handle rewards, email capture, leaderboard, or staff validation yet.

## Current QR URL Format

Existing URLs remain compatible:

```text
https://thegoldbarkohtao.com/en/treasure-hunt/bird-baths/?qr_id=birdbaths01
```

The page itself can show any existing content. The tracking script only needs the `qr_id` URL parameter.

## Scan Flow

1. Player opens a QR page.
2. `tracking.js` reads `qr_id` from the page URL.
3. `player.js` reads or creates `player_uuid` in browser storage.
4. The player can optionally enter a display name in the small page form.
5. `tracking.js` sends the scan to Google Apps Script.
6. Apps Script creates:

```text
scan_key = player_uuid + "_" + qr_id
```

7. Apps Script checks the `QR_Scans` sheet for the same `scan_key`.
8. If the key already exists, the scan is logged as a duplicate.
9. If the key is new, unique progress increases by one.
10. The frontend displays `Found X clues`.

## Components

### Frontend

- `frontend/player.js`: localStorage player handling.
- `frontend/tracking.js`: QR detection, scan submission, progress display.
- `frontend/config.js.example`: copy/paste configuration. Copy this to `config.js` for production.

### Backend

- `backend/apps-script.js`: Google Apps Script API.

### Google Sheets

Phase 1 now uses the existing development sheet rather than creating a replacement workbook.

Existing tabs:

- `QR_Scans`: append-only raw scan attempts.
- `QR_Player_Unique`: existing unique scan rollup/reporting tab.
- `QR_Player_Master`: player-level progress state.
- `Game Tiers`: existing tier threshold reference.

Apps Script does not create replacement tabs during Phase 1. It validates that the existing tabs are present.

## Apps Script API

### Health Check

```text
GET ?action=health
```

### Track Scan

```json
{
  "action": "track_scan",
  "player_uuid": "GB-20260518-ABC123",
  "player_id": "Optional Display Name",
  "qr_id": "birdbaths01",
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

### Get Progress

```text
GET ?action=get_progress&player_uuid=GB-20260518-ABC123
```

## Albato Compatibility

Set `albatoWebhookUrl` in the frontend config to mirror scan attempts to Albato during migration.

Google Apps Script remains the source of truth for duplicate prevention.
