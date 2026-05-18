# Existing Sheet Analysis

Spreadsheet:

```text
https://docs.google.com/spreadsheets/d/1AdVgrGRQjc-cisIOE6Bx55RHLFmP9NqThOFBFC2Uq3Y/edit
```

Title: `Gold Bar QR Hunt URLs`

Locale/timezone: `en_GB`, `Asia/Bangkok`

## Summary

The existing sheet already contains the core pieces needed for Phase 1:

- raw scan logging
- unique scan rollup
- player master/progress table
- tier thresholds
- historical QR scan data
- Albato webhook URL references

The project should not replace this workbook. Phase 1 should stabilize writes into the existing tabs, preserve history, and avoid changing the reward/tier logic until scan tracking is reliable.

## Tabs

### Sheet1

Purpose:

- Holds the original Albato webhook base URL.
- Lists test QR URLs using `?qr=1`, `?qr=2`, etc.

Observed columns/content:

- `Base URL`
- `QR URL 1` through `QR URL 10`

What works:

- Useful as a reference for the existing Albato webhook and early test URLs.

Issues:

- The current website QR format uses `?qr_id=...`, while this tab uses `?qr=...`.
- It is a reference/config tab, not a scan log.

Recommendation:

- Keep it for historical Albato compatibility.
- Optionally rename later to `Albato_QR_URLs` or `Legacy_QR_URLs`.

### QR_Scans

Purpose:

- Append-only scan history.
- This should remain the source of truth for raw scan attempts.

Observed header row:

```text
player_id
qr_id
timestamp
scan_key
player_uuid
```

Observed data:

- 178 data rows inspected.
- 178 rows had scan keys.
- 94 rows share a scan key with another row, meaning repeated scan attempts are already present.
- 67 rows contain Albato placeholder strings like `{%882501:...%}`.
- 78 rows have blank `player_uuid`.
- 61 rows have blank `qr_id`.
- Existing QR IDs include mixed case and naming variants, for example:
  - `BirdBath01`
  - `birdbath01`
  - `birdbaths01`
  - `WindChimes01`
  - `windchimes01`
  - `GreenGoldFountain01`
  - `SlateFountain01`
  - `Bell01`
  - `Letsgo`

What works:

- The sheet already records scan attempts.
- `scan_key` already follows the useful pattern:

```text
player_uuid + "_" + qr_id
```

- `player_uuid` is often populated and is the most reliable player identifier in existing history.

Issues:

- Some rows contain raw Albato template placeholders instead of resolved values.
- Some rows have blank player UUIDs or QR IDs.
- QR ID casing is inconsistent.
- There is no explicit `is_duplicate` column, so duplicates are inferred by checking whether `scan_key` already exists.

Recommendation:

- Do not delete historical rows.
- Treat `QR_Scans` as append-only.
- Keep writing columns A:E in the existing order.
- Use `scan_key` column D for duplicate prevention.
- Use `player_uuid` column E for progress counting.
- Avoid adding new columns until after live Phase 1 testing.

### QR_Player_Unique

Purpose:

- Unique scan rollup keyed by scan key.

Observed header row:

```text
scan_key (PRIMARY KEY)
player_id
qr_id
first_scan_timestamp
scan_count
[blank]
player_uuid
```

Observed formulas:

`scan_count` uses:

```text
=ARRAYFORMULA(IF(A2:A="","",COUNTIF(QR_Scans!D:D, A2:A)))
```

`player_uuid` area includes a `MAP` / `COUNTUNIQUE` formula that appears to be trying to count unique QR IDs from `QR_Scans`.

Observed data:

- 100 data rows inspected.
- About 20 rows include obvious broken or placeholder values such as `#REF!` or `{%882501:...%}`.

What works:

- The tab already has the right conceptual job: one row per unique `scan_key`.
- `scan_count` can identify repeated scans.

Issues:

- Some columns are blank or inconsistently populated.
- One formula appears to use a variable named `uuid` while iterating over scan keys, which may explain confusing results.
- This tab should not be the primary write target for Phase 1.

Recommendation:

- Preserve it as a reporting/diagnostic tab.
- Do not have Apps Script write directly to it during Phase 1.
- Rebuild/repair formulas later after raw scan logging is stable.

### QR_Player_Master

Purpose:

- Player-level progress and future reward/tier state.

Observed key columns:

```text
player_uuid
player_id (display name)
email (blank until captured)
email_status (none / captured / verified optional)
created_at
last_seen_at
unique_scan_count (number)
last_qr_id (latest scanned)
last_scan_at (timestamp)
current_tier (0,1,2,3…)
next_tier_target (e.g., 3,5,8…)
...
Scans Remaining
#REF!
tier2_claim_code
...
next_redirect_url
message_type
```

Observed data:

- 22 data rows inspected.
- 21 rows have a player UUID.
- 3 duplicate player UUID rows were observed.
- 1 row has a blank UUID.
- One header is currently `#REF!`.

Observed formulas:

- `next_tier_target` uses `VLOOKUP` against `Game Tiers`.
- Tier 2 and Tier 3 unlock/claim code columns include `ARRAYFORMULA`, `NOW()`, and `RANDBETWEEN()` logic.

What works:

- The tab already tracks player-level state.
- `unique_scan_count`, `last_seen_at`, and `last_scan_at` are suitable for Phase 1 progress display.
- Tier thresholds are already separated into `Game Tiers`.

Issues:

- Some reward/tier formulas are unfinished or fragile.
- `NOW()` and `RANDBETWEEN()` inside array formulas can recalculate unexpectedly.
- There are duplicate player rows.
- The `#REF!` header indicates a broken formula or overwritten column.

Recommendation:

- For Phase 1, only update stable player columns:
  - `player_uuid`
  - `player_id (display name)`
  - `created_at`
  - `last_seen_at`
  - `unique_scan_count (number)`
  - `last_qr_id (latest scanned)`
  - `last_scan_at (timestamp)`
- Do not touch reward/tier claim columns yet.
- Do not delete duplicate rows until after a backup/export.

### Game Tiers

Purpose:

- Tier threshold reference table.

Observed columns:

```text
Tier
Required Scans
```

Observed rows:

```text
1 = 5
2 = 10
3 = 15
```

What works:

- Simple and maintainable.
- Useful later for rewards/tier unlocks.

Recommendation:

- Preserve as-is.
- Do not wire live rewards into Phase 1.

## Existing Data Flow

Current historical flow appears to be:

1. QR/link scan sends data through Albato or a webhook.
2. A row is appended to `QR_Scans`.
3. `scan_key` combines player UUID and QR ID.
4. `QR_Player_Unique` rolls up repeated scan keys.
5. `QR_Player_Master` stores player progress and tier/reward-related fields.
6. `Game Tiers` provides tier thresholds.

## What Already Works

- Raw scan history exists and should be preserved.
- `QR_Scans` already has the right core columns.
- `scan_key` is already the correct duplicate-prevention concept.
- `player_uuid` is already present and should remain the stable player identifier.
- `QR_Player_Master` already has columns for progress.
- `Game Tiers` is a clean threshold table.

## What Appears Redundant

- `player_id` and `player_uuid` are not consistently used. In practice:
  - `player_uuid` should be the stable technical ID.
  - `player_id` should be the optional display name.
- `QR_Player_Unique` partly duplicates what Apps Script can calculate directly from `QR_Scans`.
- Reward/tier columns are too broad for Phase 1 and should be left alone until scan tracking is proven.

## What Appears Broken Or Unfinished

- Albato placeholder rows were logged into real data.
- Some scan rows are missing player UUID or QR ID.
- QR ID casing is inconsistent.
- `QR_Player_Master` contains duplicate player UUID rows.
- `QR_Player_Master` has a `#REF!` header.
- Some formulas use volatile functions such as `NOW()` and `RANDBETWEEN()`, which may change values unexpectedly.

## Required Backend Changes

Implemented in `backend/apps-script.js`:

- Use existing spreadsheet ID:

```text
1AdVgrGRQjc-cisIOE6Bx55RHLFmP9NqThOFBFC2Uq3Y
```

- Use existing tabs:
  - `QR_Scans`
  - `QR_Player_Unique`
  - `QR_Player_Master`
  - `Game Tiers`
- Append raw scans to `QR_Scans` columns A:E.
- Use `scan_key` column D for duplicate detection.
- Use `player_uuid` column E as the stable progress identifier.
- Update only safe progress columns in `QR_Player_Master`.
- Do not write to `QR_Player_Unique` during Phase 1.
- Do not create replacement tabs.

## Cleanup Strategy

Recommended order:

1. Make a backup copy of the spreadsheet.
2. Freeze all current historical tabs as the canonical development history.
3. Keep `QR_Scans` append-only.
4. Normalize new QR IDs going forward, preferably lowercase names such as:

```text
birdbath01
windchimes01
greengoldfountain01
slatefountain01
bell01
```

5. Add a filtered view to hide placeholder rows, not delete them.
6. Later, repair `QR_Player_Unique` formulas using `QR_Scans` as source data.
7. Later, deduplicate `QR_Player_Master` by `player_uuid` after confirming which rows are historical tests.

## Optional Improvements

- Add a `source` column to `QR_Scans` later, with values like `apps_script`, `albato`, or `manual_test`.
- Add `is_duplicate` later if staff want easier visual scanning.
- Add a dedicated `QR_Codes` reference tab later for accepted QR IDs and display names.
- Add a protected range around formula columns in `QR_Player_Unique` and reward/tier columns.
- Move reward/tier logic into Apps Script later to avoid volatile spreadsheet formulas.

## Phase 1 Principle

For now, keep the system boring:

- append every scan attempt
- prevent duplicate credit by `scan_key`
- count unique QR IDs per player UUID
- update player progress
- leave reward/tier logic untouched
