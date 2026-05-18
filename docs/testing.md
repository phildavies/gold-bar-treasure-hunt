# Phase 1 Testing Guide

## Backend Health Check

Open:

```text
YOUR_WEB_APP_URL?action=health
```

Expected result:

```json
{
  "ok": true,
  "service": "Gold Bar Treasure Hunt Scan Tracking API"
}
```

## Test A New Scan

Paste this in the browser console from a page on your website:

```js
fetch("YOUR_WEB_APP_URL", {
  method: "POST",
  headers: { "Content-Type": "text/plain;charset=utf-8" },
  body: JSON.stringify({
    action: "track_scan",
    player_id: "testplayer01",
    qr_id: "birdbaths01",
    timestamp: new Date().toISOString()
  })
}).then(r => r.json()).then(console.log);
```

Expected result on the first scan:

```json
{
  "ok": true,
  "is_duplicate": false,
  "unique_scan_count": 1,
  "total_scan_count": 1
}
```

## Test Duplicate Prevention

Run the same scan again.

Expected result:

```json
{
  "ok": true,
  "is_duplicate": true,
  "unique_scan_count": 1,
  "total_scan_count": 2
}
```

The duplicate scan should appear in the `scans` tab, but it should not increase `unique_scan_count`.

## Test Progress

Open:

```text
YOUR_WEB_APP_URL?action=get_progress&player_id=testplayer01
```

Expected result:

```json
{
  "ok": true,
  "player_id": "testplayer01",
  "unique_scan_count": 1,
  "total_scan_count": 2
}
```

## Frontend Checklist

1. Open a QR page with `?qr_id=birdbaths01`.
2. Enter a player name and save it.
3. Confirm the message says the clue was saved.
4. Confirm the `scans` sheet has a new row.
5. Refresh the page.
6. Confirm the player name is remembered.
7. Confirm the duplicate scan does not increase unique progress.
8. Visit a second QR page with a different `qr_id`.
9. Confirm unique progress increases.

## Common Issues

### Tracking says it is not configured

The frontend `apiUrl` is missing or still contains the placeholder.

### Apps Script returns permission errors

Redeploy the web app and confirm:

- `Execute as`: `Me`
- `Who has access`: `Anyone`

### Progress does not increase

Check the `scans` sheet:

- Is `player_id` present?
- Is `qr_id` present?
- Does the same `scan_key` already exist?
- Is `is_duplicate` set to `TRUE`?

### Browser request fails

Keep this content type:

```js
"Content-Type": "text/plain;charset=utf-8"
```

It avoids many browser preflight issues with Google Apps Script.
